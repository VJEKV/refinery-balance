"""Sankey Builder — граф потоков между установками."""
from typing import Dict, List, Optional
from datetime import date


def build_sankey(store, target_date: date, data_type: str = "reconciled") -> Dict:
    """
    Построить Sankey граф на конкретную дату.
    data_type: "measured" или "reconciled"
    """
    suffix = "_meas" if data_type == "measured" else "_recon"
    ds = target_date.strftime("%Y-%m-%d")
    col = f"{ds}{suffix}"

    nodes = {}
    links = []
    all_outputs = {}
    all_inputs = {}

    for code, unit_info in store.units.items():
        unit_data = unit_info["data"]
        unit_dates = unit_info["dates"]
        if target_date not in unit_dates:
            continue

        node_id = code
        nodes[node_id] = {"id": node_id, "name": unit_info["name"], "type": "unit"}

        if unit_data["outputs"] is not None and col in unit_data["outputs"].columns:
            for _, row in unit_data["outputs"].iterrows():
                product = row["product"]
                value = float(row[col]) if row[col] else 0.0
                if value > 0:
                    all_outputs.setdefault(product, []).append({
                        "unit": node_id,
                        "unit_name": unit_info["name"],
                        "value": value,
                    })

        if unit_data["inputs"] is not None and col in unit_data["inputs"].columns:
            for _, row in unit_data["inputs"].iterrows():
                product = row["product"]
                value = float(row[col]) if row[col] else 0.0
                if value > 0:
                    all_inputs.setdefault(product, []).append({
                        "unit": node_id,
                        "unit_name": unit_info["name"],
                        "value": value,
                    })

    matched_outputs = set()
    matched_inputs = set()

    for product in all_outputs:
        if product in all_inputs:
            for out_entry in all_outputs[product]:
                for in_entry in all_inputs[product]:
                    if out_entry["unit"] == in_entry["unit"]:
                        continue
                    links.append({
                        "source": out_entry["unit"],
                        "target": in_entry["unit"],
                        "value": out_entry["value"],
                        "product": product,
                        "input_value": in_entry["value"],
                        "loss": round(out_entry["value"] - in_entry["value"], 2),
                    })
                    matched_outputs.add((product, out_entry["unit"]))
                    matched_inputs.add((product, in_entry["unit"]))

    for product, entries in all_outputs.items():
        for entry in entries:
            if (product, entry["unit"]) not in matched_outputs:
                ext_id = f"ext_out_{product}"
                if ext_id not in nodes:
                    nodes[ext_id] = {"id": ext_id, "name": product, "type": "external_output"}
                links.append({
                    "source": entry["unit"],
                    "target": ext_id,
                    "value": entry["value"],
                    "product": product,
                    "input_value": 0,
                    "loss": 0,
                })

    for product, entries in all_inputs.items():
        for entry in entries:
            if (product, entry["unit"]) not in matched_inputs:
                ext_id = f"ext_in_{product}"
                if ext_id not in nodes:
                    nodes[ext_id] = {"id": ext_id, "name": product, "type": "external_input"}
                links.append({
                    "source": ext_id,
                    "target": entry["unit"],
                    "value": entry["value"],
                    "product": product,
                    "input_value": entry["value"],
                    "loss": 0,
                })

    node_list = list(nodes.values())
    node_ids = [n["id"] for n in node_list]

    indexed_links = []
    for link in links:
        if link["source"] in node_ids and link["target"] in node_ids:
            indexed_links.append({
                "source": node_ids.index(link["source"]),
                "target": node_ids.index(link["target"]),
                "value": link["value"],
                "product": link["product"],
                "input_value": link.get("input_value", 0),
                "loss": link.get("loss", 0),
                "source_name": nodes[link["source"]]["name"],
                "target_name": nodes[link["target"]]["name"],
            })

    losses_table = []
    for link in links:
        if link.get("loss", 0) != 0 and link["source"] in nodes and link["target"] in nodes:
            out_val = link["value"]
            in_val = link.get("input_value", 0)
            loss_val = link.get("loss", 0)
            loss_pct = abs(loss_val) / out_val * 100 if out_val > 0 else 0
            losses_table.append({
                "source": nodes[link["source"]]["name"],
                "target": nodes[link["target"]]["name"],
                "product": link["product"],
                "output_value": round(out_val, 2),
                "input_value": round(in_val, 2),
                "loss": round(loss_val, 2),
                "loss_pct": round(loss_pct, 2),
            })

    return {
        "nodes": node_list,
        "links": indexed_links,
        "losses": losses_table,
        "date": target_date.isoformat(),
        "data_type": data_type,
    }
