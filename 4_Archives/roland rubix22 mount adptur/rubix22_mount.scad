// ============================================================
// Roland Rubix22 机下マウントホルダー パラメトリックモデル
// 要件定義書: rubix22_desk_mount_要件定義書.md 準拠
//
// 構成: 3パーツ
//   - 左レール (left)
//   - 右レール (right, 左レールをミラー)
//   - リアタイバー (tie)  ... 左右レールを背面でつなぎ、左右の間隔を保持 & 剛性UP
//
// 仕組み:
//   天板裏に左右レールをネジ止め → Rubix22を前面(操作面)を手前に向けたまま
//   前から後ろへスライド挿入 → 本体はレールの「棚(リップ)」に自重で乗って支持
//   → 前端の半クリップ用の突起でうっかり抜け防止
//
// 印刷方向の注意 (N-2):
//   各レールは「壁の外側面を印刷ベッドに接地」させて寝かせて印刷すること。
//   (フランジを下にして縦に印刷しない！ 荷重方向に対してレイヤーが
//    剥離しやすい向きになるため)
//   寝かせて印刷することで、リップにかかる曲げ荷重の方向とレイヤー面が
//   平行になり、層間剥離に強くなる。ガセット(三角リブ)下面は45°形状のため
//   サポート材はほぼ不要 (N-3)。
//
// 使い方:
//   下の `part` 変数を "left" / "right" / "tie" に切り替えてSTLを
//   それぞれエクスポートする。"assembly" は組み立てイメージの確認用
//   (この状態ではSTLを書き出さないこと)。
// ============================================================

$fn = 48;

/* ==================== 1. 対象機器寸法 ====================
   下記は実測値 (2026-07-26 現物採寸)。
   カタログ値(Roland公表値)は 145×165×46mm で、特に奥行きが
   実測より15mmほど大きい。突起部(端子・つまみ等)を含めた値の
   可能性があるため、干渉が気になる場合は再確認のこと。
======================================================== */
device_w = 150;   // 本体 幅 (左右) mm ※実測値(カタログ値145mm)
device_d = 150;   // 本体 奥行 (前後) mm ※実測値(カタログ値165mm、差15mmに注意)
device_h = 42;    // 本体 高さ mm ※実測値(カタログ値46mm)

/* ==================== 2. クリアランス ==================== */
side_clearance    = 1.5; // 本体左右とレール内壁との隙間 (片側)
top_clearance_min = 3;   // 本体上面とフランジ下面との最小隙間 (挿抜代)

/* ==================== 2b. 鉄筋(デスク裏フレーム)の逃げ ====================
   デスク裏を「左右方向」に横切る鉄筋がマウントと干渉するための対策。
   対策は2つあり、どちらもこのセクションのパラメータから自動で効く。

   (1) 切り欠き: 鉄筋が通るY位置で、フランジと側壁の上部をコの字に削り取る。
       側壁は切り欠きの下側が前後に連続して残るため、レールは分断されない。

   (2) 吊り下げ量の自動調整: 鉄筋が本体の真上を横切る場合、本体上面が
       鉄筋の下端より下に来ないと本体自体が鉄筋にぶつかる。
       beam_over_device = true のとき top_clearance を自動で拡大する。

   ★ beam_y / beam_width / beam_drop は要実測。仮値のまま印刷しないこと。
======================================================== */
beam_notch_enable = true;
beam_y      = 0;   // レール前後中心を0としたときの鉄筋中心のY位置 (mm) ★要実測
beam_width  = 30;  // 鉄筋の前後方向の幅 (mm) ★要実測
beam_drop   = 30;  // 天板裏からの垂れ下がり量 (mm) ★要実測(申告10〜30 → 安全側の30で仮設定)
beam_clear  = 2;   // 鉄筋まわりのクリアランス
beam_over_device = true; // 鉄筋が本体の真上を横切るか (左右方向に長い鉄筋なら通常true)

/* ==================== 3. レール本体形状 ==================== */
wall_t        = 4;    // 側壁の肉厚
lip_depth     = 12;   // 側壁からユニット下面へ張り出すリップの長さ
lip_t         = 5;    // リップの厚み (本体を受ける棚板の厚み)
rail_len      = device_d - 10; // レールの前後長さ (本体奥行よりやや短く)
tab_count     = 3;    // リップを何本の支持タブに分割するか (通気確保 F-7)
tab_gap_ratio = 0.35; // タブ間の隙間の比率 (0〜1、大きいほど隙間が広い)

/* ==================== 4. フランジ (天板固定部) ==================== */
flange_w   = 22;   // フランジの張り出し幅 (ネジ穴確保用)
flange_t   = 3;    // フランジの厚み
// 使用ネジ: 全長9.5mm (0.37in) と短いため、フランジを薄くして
// 天板への食い込み量を確保している (下のecho()で食い込み量を表示)。
// 軸径・頭部径は未確認のため、screw_hole_d / countersink_d は仮値。
// 実物のネジが手元にあれば、ノギスで測って値を調整すること。
screw_length       = 9.5;  // ネジ全長 (mm)。0.37in ≒ 9.5mm
screw_hole_d      = 4.0; // ネジ用クリアランス穴径 (軸径不明のため仮値。要現物確認)
add_countersink    = true; // 皿頭ネジ用の皿もみを付けるか
countersink_d      = 8.5;  // ネジ頭部径 (未確認のため仮値。要現物確認)
countersink_depth  = 1.5;
screw_inset = 15;  // フランジ両端からネジ穴中心までの距離

board_thickness = 15; // 天板の厚さ (mm)。1.5cmとして設定 (要現物再実測)

// 天板への食い込み量 = ネジ全長 - フランジ厚 (皿もみ分は考慮せず簡易計算)
board_engagement = screw_length - flange_t;
board_remaining  = board_thickness - board_engagement; // ネジ先端から天板表面までの残り厚さ
echo(str("天板への食い込み量(目安): ", board_engagement, " mm"));
echo(str("ネジ先端〜天板表面までの残り厚さ(目安): ", board_remaining, " mm ",
    board_remaining < 0 ? "※貫通する恐れあり！ screw_length短縮 or flange_t増加が必要" :
    board_engagement < 8 ? "※食い込みはやや浅め。増し締め・木工用接着剤の併用も検討" : ""));

/* ==================== 5. ストッパー / 半クリップ ==================== */
front_stop_h = 2.5; // 前端の半クリップ用突起の高さ (きつい場合は縮小して再印刷)
rear_stop_h  = 8;   // 後端ストッパーの高さ (奥まで挿入した位置を規定)

/* ==================== 6. ガセット(補強リブ) ==================== */
gusset_t = 5; // ガセットの厚み(Y方向)

/* ==================== 6b. 接合部オーバーラップ ====================
   面同士がぴったり接するだけだとCGAL(OpenSCADのレンダラ)が
   non-manifold(不正な形状)と判定し、STLに穴/複数ボリュームが
   発生することがある。各接合部をわずかに(0.3mm)重ねて確実に
   一体化させるための共通オフセット値。
======================================================== */
ov = 0.3;

/* ==================== 7. 表示切替 ====================
   "left"     : 左レール単体 (STL出力用)
   "right"    : 右レール単体 (STL出力用)
   "tie"      : リアタイバー単体 (STL出力用)
   "assembly" : 3パーツ+本体参考形状を組んだ状態 (確認用。STL出力しない)
======================================================== */
part = "assembly";
show_device_preview = true; // assembly時に本体の参考形状(半透明)を表示するか

/* ==================== 内部寸法計算 ==================== */
inner_x    = -(device_w/2 + side_clearance); // 左レール壁の内側面(本体側)
outer_x    = inner_x - wall_t;               // 左レール壁の外側面
flange_x0  = outer_x - flange_w;             // フランジ外端
flange_x1  = outer_x;                        // フランジ内端(壁外側面と一致)

// 鉄筋が本体上を横切る場合、本体上面が鉄筋下端(-beam_drop)より
// さらに下に来るよう、吊り下げ量(top_clearance)を自動で拡大する。
top_clearance = (beam_notch_enable && beam_over_device)
    ? max(top_clearance_min, beam_drop + beam_clear - flange_t)
    : top_clearance_min;

wall_z_top    = -flange_t;                                  // 壁の上端 = フランジ下面
device_top_z  = -(flange_t + top_clearance);                 // 本体上面の想定高さ
device_bot_z  = device_top_z - device_h;                     // 本体下面の想定高さ
lip_top_z     = device_bot_z;                                 // リップ上面 = 本体下面を受ける高さ
wall_z_bottom = lip_top_z;                                    // 壁の下端 = リップ上面

lip_x0 = inner_x;               // リップ根本(壁内側面)
lip_x1 = inner_x + lip_depth;   // リップ先端(本体中心寄り)

segment_len = rail_len / tab_count;
tab_len     = segment_len * (1 - tab_gap_ratio);

/* ---------- 鉄筋の切り欠き範囲 ---------- */
notch_y0 = beam_y - (beam_width/2 + beam_clear); // 切り欠き前端
notch_y1 = beam_y + (beam_width/2 + beam_clear); // 切り欠き後端
notch_z  = -(beam_drop + beam_clear);            // 切り欠き底面(この高さまで削る)

/* ---------- ネジ穴Y位置 (切り欠きを避けて自動配置) ---------- */
screw_margin = countersink_d/2 + 2; // ネジ穴まわりに最低限必要な肉

screw_ys_base = [ -rail_len/2 + screw_inset, 0, rail_len/2 - screw_inset ];

// 切り欠きにかからないネジ穴だけ残す
screw_ys_keep = [ for (y = screw_ys_base)
    if (!beam_notch_enable || y - screw_margin > notch_y1 || y + screw_margin < notch_y0) y ];

// 除外が出た場合、切り欠きのすぐ前後に代替のネジ穴を追加する
screw_ys_add = (beam_notch_enable && len(screw_ys_keep) < len(screw_ys_base))
    ? [ for (y = [ notch_y0 - screw_margin, notch_y1 + screw_margin ])
          if (y > -rail_len/2 + screw_margin && y < rail_len/2 - screw_margin) y ]
    : [];

screw_ys = concat(screw_ys_keep, screw_ys_add);

/* ---------- 設計チェック(コンソールに表示される) ---------- */
echo(str("本体上面の高さ(天板裏基準): ", device_top_z, " mm / 鉄筋下端: ", -beam_drop, " mm"));
echo(str("マウント全体の高さ(天板裏〜リップ下面): ", -(lip_top_z - lip_t), " mm"));
echo(str("ネジ穴Y位置: ", screw_ys, "  (", len(screw_ys), "本/レール)"));
if (beam_notch_enable && len(screw_ys) < 3)
    echo("警告: 切り欠きの影響でネジ穴が3本未満。beam_y の位置を見直すか screw_inset を調整すること");
// タイバーは rail_len/2 + flange_w/2 + 2 の位置にあるため、鉄筋がそこに来ると干渉する
tie_y = rail_len/2 + flange_w/2 + 2;
if (beam_notch_enable && notch_y1 > tie_y - flange_w/2 && notch_y0 < tie_y + flange_w/2)
    echo("警告: 鉄筋がリアタイバーの位置と干渉します。タイバーを前寄りに移動するか鉄筋前方に取り付けること");

/* ==================== 部品モジュール ==================== */

// ネジ穴 (呼び出し側でtranslateして使う。ローカルZ=0がフランジ上面)
module screw_hole() {
    union() {
        translate([0, 0, -flange_t - 0.1])
            cylinder(h = flange_t + 0.2, d = screw_hole_d);
        if (add_countersink)
            translate([0, 0, -flange_t - 0.01])
                cylinder(h = countersink_depth + 0.01, d1 = countersink_d, d2 = screw_hole_d);
    }
}

// 鉄筋(デスク裏の左右方向フレーム)を逃がす切り欠き
// フランジ〜側壁上部〜ガセット上部を、鉄筋の断面より一回り大きくコの字に削る。
// X方向はレール全体を貫くので、鉄筋がレールを横切っても完全に逃げる。
module beam_notch() {
    if (beam_notch_enable)
        translate([flange_x0 - 1, notch_y0, notch_z])
            cube([(lip_x1 - flange_x0) + 2,   // X: フランジ外端〜リップ先端まで貫通
                  notch_y1 - notch_y0,        // Y: 鉄筋幅 + クリアランス
                  -notch_z + 1]);             // Z: 切り欠き底面〜天板裏より上まで
}

// 三角柱ガセット: (x,z)の三角形をY方向 y0→y1 に押し出す
module gusset_prism(x1, z1, x2, z2, x3, z3, y0, y1) {
    polyhedron(
        points = [
            [x1, y0, z1], [x2, y0, z2], [x3, y0, z3],
            [x1, y1, z1], [x2, y1, z2], [x3, y1, z3]
        ],
        faces = [
            [0, 1, 2],
            [3, 5, 4],
            [0, 3, 4, 1],
            [1, 4, 5, 2],
            [2, 5, 3, 0]
        ],
        convexity = 2
    );
}

// 左レール (基準形状。右レールはこれをミラーして使う)
module rail_left() {
    difference() {
        union() {
            // フランジ (天板固定部) ※内側(壁側)にovだけ余分に張り出して壁と重ねる
            translate([flange_x0, -rail_len/2, -flange_t])
                cube([flange_w + ov, rail_len, flange_t]);

            // 側壁 ※上下にovだけ余分に伸ばしてフランジ・タブと重ねる
            translate([outer_x, -rail_len/2, wall_z_bottom - ov])
                cube([wall_t, rail_len, (wall_z_top - wall_z_bottom) + 2*ov]);

            // リップ(支持タブ) + ガセット
            for (i = [0 : tab_count - 1]) {
                y_c = -rail_len/2 + segment_len * (i + 0.5);

                // 支持タブ ※壁側にovだけ余分に伸ばして壁と重ねる
                translate([lip_x0 - ov, y_c - tab_len/2, lip_top_z - lip_t])
                    cube([lip_depth + ov, tab_len, lip_t]);

                // ガセット(壁内側面〜リップ先端下部を斜めに補強)
                // ※壁側(X)・タブ側(Z)にovだけ食い込ませて確実に重ねる
                gusset_prism(
                    inner_x - ov, wall_z_top,
                    inner_x - ov, lip_top_z - lip_t + ov,
                    lip_x1,       lip_top_z - lip_t + ov,
                    y_c - gusset_t/2, y_c + gusset_t/2
                );
            }

            // 後端ストッパー(挿入位置の規定) ※壁側にovだけ余分に伸ばす
            translate([lip_x0 - ov, rail_len/2 - wall_t, lip_top_z])
                cube([lip_depth + ov, wall_t, rear_stop_h]);

            // 前端 半クリップ突起(抜け防止) ※壁側にovだけ余分に伸ばす
            translate([lip_x0 - ov, -rail_len/2 + 2, lip_top_z])
                cube([lip_depth + ov, 4, front_stop_h]);
        }

        // 鉄筋の逃げ(切り欠き)
        beam_notch();

        // フランジのネジ穴。ネジの食い込みが浅い(9.5mm)ため本数を増やして
        // 1本あたりの引き抜き荷重を減らしている。切り欠きにかかる位置は
        // 自動で除外され、切り欠きの前後に振り替えられる (screw_ys を参照)。
        for (y = screw_ys)
            translate([flange_x0 + flange_w/2, y, 0]) screw_hole();
    }
}

module rail_right() {
    mirror([1, 0, 0]) rail_left();
}

// リアタイバー: 左右レールの後端をつなぎ、間隔保持 & 剛性UP
module tie_bar() {
    tie_half_w = abs(outer_x) + flange_w/2; // 左右端のネジ穴X位置

    difference() {
        translate([outer_x, -flange_w/2, -flange_t])
            cube([2 * abs(outer_x), flange_w, flange_t]);

        translate([-tie_half_w, 0, 0]) screw_hole();
        translate([ tie_half_w, 0, 0]) screw_hole();
    }
}

// 本体の参考形状 (assembly確認用。印刷対象ではない)
module device_reference() {
    color([0.3, 0.6, 1, 0.3])
        translate([-device_w/2, -device_d/2, device_bot_z])
            cube([device_w, device_d, device_h]);
}

// 鉄筋の参考形状 (assembly確認用。印刷対象ではない)
// 切り欠きを通り抜けているか、本体と干渉していないかの目視確認用。
module beam_reference() {
    if (beam_notch_enable)
        color([1, 0.35, 0.2, 0.45])
            translate([flange_x0 - 25, beam_y - beam_width/2, -beam_drop])
                cube([2 * abs(flange_x0 - 25), beam_width, beam_drop]);
}

/* ==================== 出力切り替え ==================== */
if (part == "left") {
    rail_left();
} else if (part == "right") {
    rail_right();
} else if (part == "tie") {
    translate([0, rail_len/2 + flange_w/2 + 2, 0]) tie_bar();
} else if (part == "assembly") {
    rail_left();
    rail_right();
    translate([0, rail_len/2 + flange_w/2 + 2, 0]) tie_bar();
    if (show_device_preview) device_reference();
    beam_reference();
}
