// 手書きキャンバス。window.openHandwriting() が PNG の Blob（キャンセルなら null）を返す Promise を返す。
// 指・スタイラスペン・マウスに対応。ペンが使われたら、手のひらが触れた指入力は無視する。
(function () {
  var PAPER = '#fffcf6';
  var COLORS = [
    { name: '墨', value: '#30271f' },
    { name: '茶', value: '#79572f' },
    { name: '青', value: '#2f5f8f' },
    { name: '赤', value: '#b3392f' },
  ];
  var SIZES = [
    { name: '細', w: 2 },
    { name: '中', w: 4 },
    { name: '太', w: 8 },
  ];
  var ERASER_SCALE = 5;
  var MAX_DPR = 2;

  function buildDialog() {
    var dlg = document.createElement('dialog');
    dlg.className = 'hw-dialog';
    dlg.setAttribute('aria-label', '手書き');
    dlg.innerHTML =
      '<div class="hw-toolbar">' +
      '<div class="hw-group" data-role="colors">' +
      COLORS.map(function (c, i) {
        return '<button type="button" class="hw-color" data-color="' + i + '" aria-label="' + c.name + '" title="' + c.name + '" style="--swatch:' + c.value + '"></button>';
      }).join('') +
      '</div>' +
      '<div class="hw-group" data-role="sizes">' +
      SIZES.map(function (s, i) {
        return '<button type="button" class="hw-btn" data-size="' + i + '">' + s.name + '</button>';
      }).join('') +
      '</div>' +
      '<div class="hw-group">' +
      '<button type="button" class="hw-btn" data-tool="pen">ペン</button>' +
      '<button type="button" class="hw-btn" data-tool="eraser">消しゴム</button>' +
      '</div>' +
      '<div class="hw-group">' +
      '<button type="button" class="hw-btn" data-act="undo">↶ 戻す</button>' +
      '<button type="button" class="hw-btn" data-act="clear">全消し</button>' +
      '</div>' +
      '</div>' +
      '<div class="hw-stage"><canvas class="hw-canvas" aria-label="手書きキャンバス"></canvas></div>' +
      '<div class="hw-actions">' +
      '<button type="button" class="secondary" data-act="cancel">キャンセル</button>' +
      '<button type="button" class="primary" data-act="save">この手書きを追加</button>' +
      '</div>';
    document.body.appendChild(dlg);
    return dlg;
  }

  window.openHandwriting = function openHandwriting() {
    return new Promise(function (resolve) {
      var dlg = buildDialog();
      var stage = dlg.querySelector('.hw-stage');
      var canvas = dlg.querySelector('.hw-canvas');
      var ctx = canvas.getContext('2d');
      var saveBtn = dlg.querySelector('[data-act="save"]');
      var dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

      var strokes = [];
      var current = null;
      var activePointer = null;
      var penSeen = false;
      var colorIdx = 0;
      var sizeIdx = 1;
      var tool = 'pen';
      var finished = false;
      var prevBodyOverflow = document.body.style.overflow;

      function finish(blob) {
        if (finished) return;
        finished = true;
        document.body.style.overflow = prevBodyOverflow;
        if (dlg.open) dlg.close();
        dlg.remove();
        resolve(blob);
      }

      function widthOf(stroke, p) {
        return stroke.width * p.f;
      }

      function drawSegment(c, stroke, a, b) {
        c.strokeStyle = stroke.color;
        c.lineWidth = widthOf(stroke, b);
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.stroke();
      }

      function drawDot(c, stroke, p) {
        c.fillStyle = stroke.color;
        c.beginPath();
        c.arc(p.x, p.y, widthOf(stroke, p) / 2, 0, Math.PI * 2);
        c.fill();
      }

      function replay(c, list) {
        list.forEach(function (s) {
          if (s.pts.length === 1) drawDot(c, s, s.pts[0]);
          for (var i = 1; i < s.pts.length; i++) drawSegment(c, s, s.pts[i - 1], s.pts[i]);
        });
      }

      function paintAll() {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = PAPER;
        ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        replay(ctx, strokes);
        saveBtn.disabled = strokes.length === 0;
      }

      function resizeCanvas() {
        var rect = stage.getBoundingClientRect();
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
        paintAll();
      }

      function point(e) {
        var r = canvas.getBoundingClientRect();
        var f = 1;
        if (e.pointerType === 'pen' && e.pressure > 0) f = 0.4 + e.pressure * 1.2;
        return { x: e.clientX - r.left, y: e.clientY - r.top, f: f };
      }

      function currentStyle(e) {
        var eraser = tool === 'eraser' || (e.pointerType === 'pen' && (e.buttons & 32) !== 0);
        return {
          color: eraser ? PAPER : COLORS[colorIdx].value,
          width: SIZES[sizeIdx].w * (eraser ? ERASER_SCALE : 1),
        };
      }

      canvas.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'pen') penSeen = true;
        if (e.pointerType === 'touch' && penSeen) return; // パームリジェクション
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (activePointer !== null) return;
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        activePointer = e.pointerId;
        var style = currentStyle(e);
        current = { color: style.color, width: style.width, pts: [point(e)] };
        strokes.push(current);
        drawDot(ctx, current, current.pts[0]);
        saveBtn.disabled = false;
      });

      canvas.addEventListener('pointermove', function (e) {
        if (e.pointerId !== activePointer || !current) return;
        e.preventDefault();
        var events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
        if (!events.length) events = [e];
        events.forEach(function (ev) {
          var p = point(ev);
          var last = current.pts[current.pts.length - 1];
          current.pts.push(p);
          drawSegment(ctx, current, last, p);
        });
      });

      function endStroke(e) {
        if (e.pointerId !== activePointer) return;
        activePointer = null;
        current = null;
      }
      canvas.addEventListener('pointerup', endStroke);
      canvas.addEventListener('pointercancel', endStroke);
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

      // 点だけ・短い線も含め、描いた範囲に余白を付けて切り出す
      function exportPng() {
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        strokes.forEach(function (s) {
          s.pts.forEach(function (p) {
            var r = widthOf(s, p) / 2;
            minX = Math.min(minX, p.x - r);
            minY = Math.min(minY, p.y - r);
            maxX = Math.max(maxX, p.x + r);
            maxY = Math.max(maxY, p.y + r);
          });
        });
        var pad = 24;
        var cssW = canvas.width / dpr;
        var cssH = canvas.height / dpr;
        var x0 = Math.max(0, Math.floor(minX - pad));
        var y0 = Math.max(0, Math.floor(minY - pad));
        var x1 = Math.min(cssW, Math.ceil(maxX + pad));
        var y1 = Math.min(cssH, Math.ceil(maxY + pad));
        var out = document.createElement('canvas');
        out.width = Math.max(1, Math.round((x1 - x0) * dpr));
        out.height = Math.max(1, Math.round((y1 - y0) * dpr));
        var oc = out.getContext('2d');
        oc.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr);
        oc.fillStyle = PAPER;
        oc.fillRect(x0, y0, x1 - x0, y1 - y0);
        replay(oc, strokes);
        return new Promise(function (res) { out.toBlob(res, 'image/png'); });
      }

      function refreshToolbar() {
        dlg.querySelectorAll('[data-color]').forEach(function (b) {
          b.classList.toggle('active', Number(b.dataset.color) === colorIdx && tool === 'pen');
        });
        dlg.querySelectorAll('[data-size]').forEach(function (b) {
          b.classList.toggle('active', Number(b.dataset.size) === sizeIdx);
        });
        dlg.querySelectorAll('[data-tool]').forEach(function (b) {
          b.classList.toggle('active', b.dataset.tool === tool);
        });
      }

      dlg.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        if (btn.dataset.color !== undefined) {
          colorIdx = Number(btn.dataset.color);
          tool = 'pen';
        } else if (btn.dataset.size !== undefined) {
          sizeIdx = Number(btn.dataset.size);
        } else if (btn.dataset.tool) {
          tool = btn.dataset.tool;
        } else if (btn.dataset.act === 'undo') {
          strokes.pop();
          paintAll();
        } else if (btn.dataset.act === 'clear') {
          if (strokes.length && confirm('手書きをすべて消しますか？')) {
            strokes = [];
            paintAll();
          }
        } else if (btn.dataset.act === 'cancel') {
          if (!strokes.length || confirm('書いた内容を破棄しますか？')) finish(null);
        } else if (btn.dataset.act === 'save') {
          if (!strokes.length) return;
          saveBtn.disabled = true;
          exportPng().then(finish);
        }
        refreshToolbar();
      });

      // Esc では閉じない（書きかけを誤って失わないように）。キャンセルボタンで確認してから閉じる。
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); });

      document.body.style.overflow = 'hidden';
      dlg.showModal();
      refreshToolbar();
      requestAnimationFrame(function () {
        resizeCanvas();
        saveBtn.disabled = true;
      });
    });
  };
})();
