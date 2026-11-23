// リモコン収納ケース（ポール固定・締め付け式）
// 座標系: Z=ポール軸(上), X=幅, Y=奥行き。ポールは原点(0,0)、ケースは -Y 側、切れ目と耳は +Y 側。
// 使い方: openscad -D 'part="full"' -o case.stl remote_case.scad   （part = "full" | "proto"）

part = "full";          // "full" = ケース+締め付け部 / "proto" = 締め付け部のみの試作

// ===== 実測値（確定） =====
remote_len   = 136.8;   // リモコン全長
remote_w     = 39.3;    // リモコン幅
remote_t     = 21;      // リモコン厚み
pole_d       = 18.8;    // ポール直径

// ===== ※仮置き値（印刷後に調整） =====
// ケース本体
pocket_clear = 0.5;     // ※ 片側の余裕
pocket_w     = remote_w + 2*pocket_clear;   // ※ 40.3
pocket_d     = 22.0;    // ※ 奥行き内寸（厚み21 + 余裕）
pocket_depth = 100;     // ※ ポケットの深さ
wall         = 2.4;     // ※ 壁厚
floor_t      = 2.4;     // ※ 底厚（閉じる）
notch_w      = 20;      // ※ 前面の指かけ切り欠き幅
notch_h      = 30;      // ※ 前面の指かけ切り欠き深さ（上端から）
// 締め付け部
bore_d       = 19.0;    // ※ 内径
band_t       = 3;       // ※ バンド厚み
clamp_h      = 30;      // ※ 高さ
gap          = 3;       // ※ 切れ目の隙間
ear_t        = 7;       // ※ 耳の厚み（片側）
ear_w        = 12;      // ※ 耳の張り出し量（バンド外周から。元は16）
clamp_square = false;   // true = 外周を四角形（穴は丸のまま） / false = 円形
fillet_r     = 2;       // ※ 耳の根元・ケースとの接合部の丸み（割れ対策）
tip_r        = 1;       // ※ 耳の先端の角の丸み
clamp_z0     = 35;    // ※ ケース底からクランプ下端までの高さ
// ボルト・ナット（M4）
bolt_d       = 4.5;     // ボルト穴径
nut_af       = 7.4;     // ナット六角ポケット 対辺
nut_depth    = 3.6;     // ナットポケット深さ
// 試作
proto_h      = 10;      // 試作リング高さ

// ===== 導出値 =====
ri     = bore_d/2;
ro     = ri + band_t;
case_w = pocket_w + 2*wall;
case_d = pocket_d + 2*wall;
case_h = floor_t + pocket_depth;
bolt_y = ro + ear_w/2;           // ボルト軸のY位置
ear_x_out = gap/2 + ear_t;       // 耳の外面X

echo(str("内寸(ポケット) ", pocket_w, " x ", pocket_d, " 深さ ", pocket_depth));
echo(str("外寸(ケース) ", case_w, " x ", case_d, " 高さ ", case_h));
echo(str("クランプ 内径 ", bore_d, " 外径 ", 2*ro, " 高さ ", clamp_h));
echo(str("ボルト軸 Y=", bolt_y, " Z(クランプ下端から)=", clamp_h/2, " 耳外面 X=±", ear_x_out));

// クランプ外形の2D断面。凹んだ角（耳の根元・リングとケースのつなぎ目）を fillet_r で丸め、
// 出っ張った角（耳の先端）を tip_r で丸める。切れ目は後で引くので、耳は一体のブロックにしておく。
module outline2d(with_case) {
    y_front = -(ro + pocket_d + wall);
    offset(r = tip_r) offset(r = -tip_r)
    offset(r = -fillet_r) offset(r = fillet_r)
    union() {
        if (clamp_square) square(2*ro, center = true);
        else circle(r = ro, $fn = 180);
        translate([-ear_x_out, 0]) square([2*ear_x_out, ro + ear_w]);
        if (with_case) translate([-case_w/2, y_front]) square([case_w, case_d]);
    }
}

module clamp(h, with_case = false) {
    difference() {
        linear_extrude(h) outline2d(with_case);
        translate([0, 0, -1]) cylinder(r = ri, h = h + 2, $fn = 180);       // ポール穴
        translate([-gap/2, 0, -1]) cube([gap, ro + ear_w + 1, h + 2]);       // 切れ目
        translate([-ear_x_out - 1, bolt_y, h/2])                             // ボルト穴(X軸)
            rotate([0, 90, 0]) cylinder(d = bolt_d, h = 2*ear_x_out + 2, $fn = 48);
        // ナット六角ポケット（+X側の耳の外面から。角がY方向、平面がZ方向を向く）
        translate([ear_x_out - nut_depth, bolt_y, h/2])
            rotate([0, 90, 0]) rotate([0, 0, 90])
                cylinder(d = nut_af / cos(30), h = nut_depth + 1, $fn = 6);
    }
}

module case_body() {
    y_front = -(ro + pocket_d + wall);   // 前面の外側
    difference() {
        translate([-case_w/2, y_front, 0]) cube([case_w, case_d, case_h]);
        // ポケット（底は閉じる）
        translate([-pocket_w/2, -(ro + pocket_d), floor_t])
            cube([pocket_w, pocket_d, case_h]);
        // 前面の指かけ切り欠き（下端は丸め）
        r = notch_w/2;
        hull() {
            translate([0, y_front - 1, case_h - notch_h + r])
                rotate([-90, 0, 0]) cylinder(r = r, h = wall + 2, $fn = 64);
            translate([-r, y_front - 1, case_h])
                cube([2*r, wall + 2, 1]);
        }
    }
}

if (part == "proto") {
    clamp(proto_h);
} else {
    union() {
        case_body();
        translate([0, 0, clamp_z0]) clamp(clamp_h, true);
    }
}
