#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import shutil
import re

ROOT = r"G:\草稿\待辦事項\APP_!"

PAGE_MAP = {
    "index.html": "首頁.html",
    "pages/auth.html": "基本資料.html",
    "pages/cart.html": "購買清單.html",
    "pages/checkout.html": "結帳.html",
    "pages/order-history.html": "訂單詳情.html",
    "pages/product-detail.html": "產品介紹.html",
}

# 無效檔案（404 佔位）
INVALID_FILES = [
    "pages/order-detail.html",
    "pages/order-review.html",
    "pages/product.html",
]

# 通用文字替換：適用於所有 HTML/JS/JSON 內容
TEXT_REPLACEMENTS = {
    # 資源路徑
    '../manifest.json': 'manifest.json',
    '../js/': 'js/',
    '../css/': 'css/',
    '../icons/': 'icons/',
    # 頁面連結
    '../index.html': '首頁.html',
    'pages/auth.html': '基本資料.html',
    'pages/cart.html': '購買清單.html',
    'pages/checkout.html': '結帳.html',
    'pages/order-history.html': '訂單詳情.html',
    'pages/product-detail.html': '產品介紹.html',
    # 無對應頁面，導回首頁
    'pages/category.html': '首頁.html',
    'pages/holiday.html': '首頁.html',
}


def read_file(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        return f.read()


def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)


def apply_replacements(content):
    for old, new in TEXT_REPLACEMENTS.items():
        content = content.replace(old, new)
    # 首頁.html 原本在根目錄的連結
    content = content.replace('href="index.html"', 'href="首頁.html"')
    return content


def rewrite_getpath_to(content):
    # 替換 getPathTo 函式本體
    pattern = r"function getPathTo\(targetPathFromRoot\) \{[\s\S]*?\n\}"
    new_func = '''function getPathTo(targetPathFromRoot) {
  // 所有頁面現在都在根目錄，直接返回對應的中文檔名
  const pageMap = {
    "index.html": "首頁.html",
    "pages/auth.html": "基本資料.html",
    "pages/auth.html?notice=verify-email": "基本資料.html?notice=verify-email",
    "pages/cart.html": "購買清單.html",
    "pages/checkout.html": "結帳.html",
    "pages/order-history.html": "訂單詳情.html",
    "pages/product-detail.html": "產品介紹.html"
  };
  return pageMap[targetPathFromRoot] || targetPathFromRoot;
}'''
    return re.sub(pattern, new_func, content)


def main():
    # 1. 刪除無效檔案
    for rel in INVALID_FILES:
        path = os.path.join(ROOT, rel)
        if os.path.exists(path):
            os.remove(path)
            print(f"移除無效檔案: {rel}")

    # 2. 移動/重命名頁面
    for src_rel, dst_name in PAGE_MAP.items():
        src = os.path.join(ROOT, src_rel)
        dst = os.path.join(ROOT, dst_name)
        if not os.path.exists(src):
            print(f"跳過（不存在）: {src_rel}")
            continue
        content = read_file(src)
        content = apply_replacements(content)
        write_file(dst, content)
        print(f"建立: {dst_name} (來自 {src_rel})")

    # 3. 刪除原 index.html 與 pages/ 目錄
    old_index = os.path.join(ROOT, "index.html")
    if os.path.exists(old_index):
        os.remove(old_index)
        print("移除舊 index.html")

    pages_dir = os.path.join(ROOT, "pages")
    if os.path.exists(pages_dir):
        shutil.rmtree(pages_dir)
        print("移除舊 pages/ 目錄")

    # 4. 修改 js/supabaseClient.js
    sc_path = os.path.join(ROOT, "js", "supabaseClient.js")
    if os.path.exists(sc_path):
        content = read_file(sc_path)
        content = apply_replacements(content)
        content = rewrite_getpath_to(content)
        write_file(sc_path, content)
        print("更新 js/supabaseClient.js")

    # 5. 修改 js/nav.js
    nav_path = os.path.join(ROOT, "js", "nav.js")
    if os.path.exists(nav_path):
        content = read_file(nav_path)
        content = apply_replacements(content)
        write_file(nav_path, content)
        print("更新 js/nav.js")

    # 6. 修改 manifest.json
    manifest_path = os.path.join(ROOT, "manifest.json")
    if os.path.exists(manifest_path):
        content = read_file(manifest_path)
        content = content.replace('"/index.html"', '"/首頁.html"')
        content = content.replace('"index.html"', '"首頁.html"')
        write_file(manifest_path, content)
        print("更新 manifest.json")

    # 7. 補救：把舊中文頁面從 _local_backup 複製回來（未對應的也先保留備份狀態，不覆蓋）
    # 這裡不做，避免干擾線上版結構

    print("\n完成。新頁面清單：")
    for name in sorted(PAGE_MAP.values()):
        print(f"  {name}")


if __name__ == "__main__":
    main()
