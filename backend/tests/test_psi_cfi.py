"""Парсери знімка CFI (PSI-39) без мережі й без реальних даних."""

import io
import zipfile

from flame.ingest import psi_cfi


def _xlsx(sheets: dict[str, list[list]]) -> bytes:
    """Мінімальний xlsx: inline-рядки й числа, як їх пише Excel (без sharedStrings)."""
    buf = io.BytesIO()
    ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    rns = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    with zipfile.ZipFile(buf, "w") as z:
        sheet_tags, rels = [], []
        for i, (name, rows) in enumerate(sheets.items(), 1):
            sheet_tags.append(f'<sheet name="{name}" sheetId="{i}" r:id="rId{i}"/>')
            rels.append(f'<Relationship Id="rId{i}" Target="worksheets/sheet{i}.xml"/>')
            xml_rows = []
            for r, row in enumerate(rows, 1):
                cells = []
                for c, v in enumerate(row):
                    ref = f"{chr(65 + c)}{r}"
                    if v is None:
                        continue
                    if isinstance(v, str):
                        cells.append(f'<c r="{ref}" t="inlineStr"><is><t>{v}</t></is></c>')
                    else:
                        cells.append(f'<c r="{ref}"><v>{v}</v></c>')
                xml_rows.append(f'<row r="{r}">{"".join(cells)}</row>')
            z.writestr(
                f"xl/worksheets/sheet{i}.xml",
                f'<worksheet xmlns="{ns}"><sheetData>{"".join(xml_rows)}</sheetData></worksheet>',
            )
        z.writestr(
            "xl/workbook.xml",
            f'<workbook xmlns="{ns}" xmlns:r="{rns}">'
            f"<sheets>{''.join(sheet_tags)}</sheets></workbook>",
        )
        z.writestr("xl/_rels/workbook.xml.rels", f"<Relationships>{''.join(rels)}</Relationships>")
    return buf.getvalue()


SUMMARY = {
    "Master Sheet": [
        [
            "Flex Number",
            "Test Date",
            "Local Time",
            "CIR ",
            "Pressure",
            "Oxygen",
            "Nitrogen",
            "Helium",
            "Fiber",
            "Fuel ",
        ],
        [1206, 42803, "02:03:08 pm est", "f068a03", "1 atm ", 0.21, 0.79, 0, "No", "C12H26"],
        [
            1290,
            42908,
            "",
            "f177d01",
            ".75 atm",
            0.17,
            0.54,
            0.29,
            None,
            "[.60]/[.40] C12H26/iso-dodecane ",
        ],
    ],  # fmt: skip
    "DATA": [
        [
            "Flex Number",
            "D0 ( mm )",
            "Dext, hot ( mm )",
            " khot ( mm^2/s )",
            "kcool ( mm^2/s )",
            "Dext,cool ( mm )",
            "Pressure (atm)",
            "Reignitions",
            "Extrap CF?",
        ],
        [1206, 4.039, 3.577, 0.379, 0.385, None, 1, 0, 0],
    ],  # fmt: skip
    "Igniter": [
        ["Flex Number", "Ignition Power ( W )", "Ignition Time ( ms )"],
        [1206, "12 w", "3700 ms"],
    ],
    "Comments": [["Flex Number", "Comments "], [1206, "Excellent  deployment."]],
}


def test_read_xlsx_keeps_column_positions():
    sheets = psi_cfi.read_xlsx(_xlsx({"S": [["a", None, "c"], [1, None, 3]]}))
    assert sheets["S"] == [["a", None, "c"], [1.0, None, 3.0]]


def test_parse_summary_normalizes_conditions():
    t1206, t1290 = psi_cfi.parse_summary(psi_cfi.read_xlsx(_xlsx(SUMMARY)))
    assert t1206["test_date"] == "2017-03-09"
    assert t1206["cir_id"] == "F068A03"
    assert (t1206["fuel"], t1206["x_dodecane"], t1206["p_atm"]) == ("dodecane", 1.0, 1.0)
    assert t1206["fiber"] is False and t1206["diluent"] == "N2"
    assert (t1206["d0_mm"], t1206["k_hot_mm2_s"], t1206["dext_cool_mm"]) == (4.039, 0.379, None)
    assert t1206["cool_flame_extrapolated"] is False
    assert (t1206["ignition_power_w"], t1206["ignition_time_ms"]) == (12.0, 3700.0)
    assert t1206["comment"] == "Excellent deployment."
    assert (t1290["fuel"], t1290["x_dodecane"], t1290["p_atm"]) == (
        "dodecane/isododecane",
        0.6,
        0.75,
    )
    assert t1290["fiber"] is None and t1290["diluent"] == "He"
    assert t1290["d0_mm"] is None  # немає рядка в DATA


def test_cross_check_reports_mismatches_and_dedups_table():
    tests = psi_cfi.parse_summary(psi_cfi.read_xlsx(_xlsx(SUMMARY)))
    table = (
        "Flex Number,Test Date,Local Time,CIR ,Pressure,Oxygen,Nitrogen,Helium,Fiber,Fuel \n"
        "1206,9-Mar-17,x,f068a03,1 atm ,0.21,0.79,0,Yes,C12H26\n"
        "1206,9-Mar-17,x,f068a03,1 atm ,0.21,0.79,0,Yes,C12H26\n"
    )
    psi = psi_cfi.parse_psi_table(table)
    assert list(psi) == [1206]
    assert psi_cfi.cross_check(tests, psi) == ["1206: fiber xlsx=False psi=True"]
    assert [t["in_psi_table"] for t in tests] == [True, False]


def test_classify_and_bind():
    by_no = {1206: {}, 1290: {}}
    by_cir = {"F068A03": 1206, "F177D01": 1290}
    cases = {
        "PSI-39_Raw Data_FLEX-1206_DropletData.txt": ("droplet_ts", 1206, "flex_name"),
        "PSI-39_Raw Data_F068A03_Chamber_Readings.txt": ("chamber_ts", 1206, "cir_name"),
        "PSI-39_Raw Data_F068A03D.txt": ("camera_index_txt", 1206, "cir_name"),
        "PSI-39_Raw Data_F177D01.txt": ("testpoint_log", 1290, "cir_name"),
        "PSI-39_Raw Data_F177D01A.zip": ("camera_images_zip", 1290, "cir_name"),
        "PSI-39_Analyzed Data_FLEX-1206_Summary-prelim.pdf": ("summary_pdf", 1206, "flex_name"),
        "PSI-39_Raw Data_VaporCloudImage.pdf": ("other_pdf", 1206, "flex_folder"),
    }
    for name, (kind, tno, how) in cases.items():
        cat = "Analyzed Data" if "Analyzed" in name else "Raw Data"
        f = {"name": name, "category": cat, "subfolder": "CFI – DODECANE/FLEX-1206 - F068A03"}
        assert psi_cfi.classify(name)[0] == kind, name
        assert psi_cfi.bind(f, by_no, by_cir) == (tno, how), name
    doc = {"name": "PSI-39_Reports_x.pdf", "category": "Reports", "subfolder": ""}
    assert psi_cfi.bind(doc, by_no, by_cir) == (None, "")
