"""
七七地赦订单报表生成器
这个脚本会从对话存档中提取订单信息，并生成类似图片格式的 Excel 报表
"""

import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from datetime import datetime

# 创建新的工作簿
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "七七地赦登記名冊"

# 设置标题
ws['A1'] = "本 2026(丙午) 年度七七地赦日執執登記名冊"
ws['A1'].font = Font(size=16, bold=True)
ws.merge_range('A1:K1')

# 右上角写"分會"
ws['L1'] = "分會："
ws['L1'].alignment = Alignment(horizontal='right')

# 定义表头
headers = [
    "編號", "日期", "代表人姓名", "虛歲", "電話", "地址",
    "個人者乎\n原功德鑫 $7700\n特價$770",
    "家庭者乎\n原功德鑫 $33000\n特價$11000",
    "事業者乎\n原功德鑫 $77000\n特價$11000",
    "社會者乎\n原功德鑫 $77000\n特價$11000",
    "救世 (主) 者乎\n原功德鑫 $77000\n特價$11000",
    "代理登記者"
]

# 写入表头
for col_num, header in enumerate(headers, 1):
    cell = ws.cell(row=2, column=col_num, value=header)
    cell.font = Font(bold=True, size=10)
    cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)

# 设置列宽
column_widths = {
    'A': 5,   # 编号
    'B': 12,  # 日期
    'C': 12,  # 代表人姓名
    'D': 8,   # 虚岁
    'E': 12,  # 电话
    'F': 25,  # 地址
    'G': 14,  # 个人者乎
    'H': 14,  # 家庭者乎
    'I': 14,  # 事業者乎
    'J': 14,  # 社會者乎
    'K': 14,  # 救世主者乎
    'L': 12   # 代理登記者
}

for col, width in column_widths.items():
    ws.column_dimensions[col].width = width

# 设置边框样式
thin_border = Border(
    left=Side(style='thin'),
    right=Side(style='thin'),
    top=Side(style='thin'),
    bottom=Side(style='thin')
)

# 应用边框到所有单元格（包括空行）
for row in range(2, 13):  # 表头 + 10 行数据
    for col in range(1, 13):
        ws.cell(row=row, column=col).border = thin_border
        ws.cell(row=row, column=col).alignment = Alignment(horizontal='center', vertical='center')

# 底部总金额行
ws['A13'] = "總金額"
ws.merge_range('A13:F13')
ws['A13'].alignment = Alignment(horizontal='center', vertical='center')
ws.cell(row=13, column=13).border = thin_border

# 添加备注
ws['A14'] = "※登記期限：即日起至農曆七月七日 (國曆 8/19) 中午 12 時止"
ws['A14'].font = Font(size=10, bold=True)
ws.merge_range('A14:L14')
ws['A14'].alignment = Alignment(horizontal='center', vertical='center')

# 添加印章文字
ws['A15'] = "本忠忠懿懿．忠忠懿懿活佛本尊．活佛本殿 勅監 勅封"
ws['A15'].font = Font(size=12, bold=True)
ws.merge_range('A15:L15')
ws['A15'].alignment = Alignment(horizontal='center', vertical='center')

# 保存文件
output_file = "G:\\草稿\\待辦事項\\APP_!\\七七地赦訂單登記名冊_2026-08-12.xlsx"
wb.save(output_file)

print(f"✓ 报表已生成：{output_file}")
print("✓ 报表包含 10 行空白登记表，可根据实际订单填写")
