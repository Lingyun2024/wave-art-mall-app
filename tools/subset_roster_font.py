#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
subset_roster_font.py —— 七七地赦名冊字型瘦身工具

【背景】
  assets/fonts/TEST_latest.ttf 原始大小 20.1 MB（glyf 表佔 19.5 MB），
  被 my-roster / holiday-form / admin-roster / admin-roster-headquarter
  四個頁面載入。但該字型在頁面中只套用於 .custom-glyph 這個 class，
  實際用到的字元只有 U+A00A（彝文區碼位，當裝飾字用）。
  → 用 fontTools subset 保留「所有造字區」即可，其餘漢字交給系統字型。

【實測結果】
  20.1 MB → 153 KB（省 99.2%），造字字形輪廓完整（含 composite 組合字）。

【用法】
  python tools/subset_roster_font.py

【若未來需要新增字元】
  修改下方 RANGES 後重跑即可。例如要讓 .custom-glyph 也能顯示一般漢字，
  加入 (0x4E00, 0x9FFF)（會使檔案增至約 2 MB）。

【為何不直接刪掉字型】
  頁面有 <span class="custom-glyph">&#xA00A;&#xA00A;</span>，
  U+A00A 是自造字，刪掉字型會變成豆腐方塊，故必須 subset 而非移除。
"""
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

# 專案根目錄（本檔位於 <root>/tools/）
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "fonts", "TEST_latest.ttf")
OUT = os.path.join(ROOT, "assets", "fonts", "RosterGlyph-subset.ttf")

# 要保留的碼位範圍
RANGES = [
    (0x0020, 0x007E),   # ASCII
    (0x00A0, 0x00FF),   # 拉丁補充
    (0x2000, 0x206F),   # 通用標點
    (0x20A0, 0x20BF),   # 貨幣符號
    (0x2100, 0x214F),   # 字母式符號
    (0x2190, 0x21FF),   # 箭頭
    (0x2200, 0x22FF),   # 數學運算子
    (0x2460, 0x24FF),   # 帶圈數字
    (0x25A0, 0x25FF),   # 幾何圖形
    (0x2600, 0x26FF),   # 雜項符號
    (0x3000, 0x303F),   # CJK 標點
    (0xFE50, 0xFE6B),   # 小型標點變體
    (0xFF00, 0xFFEF),   # 全形
    (0x9FA0, 0x9FFF),   # CJK 尾段造字（53 個）
    (0xA000, 0xA4CF),   # Yi 彝文區（含實際使用的 A00A）
    (0xE000, 0xF8FF),   # PUA 自造字（31 個）
    # (0x4E00, 0x9FFF), # ← 若需在 .custom-glyph 內用一般漢字，取消註解
]


def main():
    if not os.path.exists(SRC):
        print(f"[錯誤] 找不到來源字型：{SRC}")
        print("       若原始 21MB 字型已封存，請先把它複製回來再執行。")
        return 1

    codepoints = []
    for start, end in RANGES:
        codepoints.extend(range(start, end + 1))

    opts = subset.Options()
    opts.layout_features = ["*"]
    opts.notdef_outline = True
    opts.drop_tables += ["DSIG"]
    opts.name_IDs = ["*"]
    opts.name_legacy = True

    font = subset.load_font(SRC, opts)
    subsetter = subset.Subsetter(options=opts)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    subset.save_font(font, OUT, opts)
    font.close()

    src_mb = os.path.getsize(SRC) / 1024 / 1024
    out_kb = os.path.getsize(OUT) / 1024
    print(f"原始 {src_mb:.2f} MB  ->  產出 {out_kb:.1f} KB  (省 {100 - out_kb / 1024 / src_mb * 100:.1f}%)")

    # 驗證關鍵造字碼位仍在，且輪廓非空
    from fontTools.pens.boundsPen import BoundsPen

    check = TTFont(OUT)
    cmap = check.getBestCmap()
    glyf = check["glyf"]
    glyph_set = check.getGlyphSet()
    for cp, label in [
        (0xA00A, "Yi 裝飾字（頁面實際使用）"),
        (0xE000, "PUA E000（composite）"),
        (0xE024, "PUA E024"),
        (0x9FE6, "CJK 尾段 9FE6"),
    ]:
        if cp not in cmap:
            print(f"  [警告] U+{cp:04X} {label} —— 不在產出字型中")
            continue
        glyph = glyf[cmap[cp]]
        pen = BoundsPen(glyph_set)
        try:
            glyph.draw(pen, glyf)
        except Exception:
            pass
        state = "有輪廓" if pen.bounds else "空白（異常）"
        print(f"  U+{cp:04X} {label} —— {state}")

    print(f"產出碼位數 {len(cmap)}，字形數 {check['maxp'].numGlyphs}")
    print("\n提醒：若四個頁面的 @font-face 仍指向 TEST_latest.ttf，請改為 RosterGlyph-subset.ttf。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
