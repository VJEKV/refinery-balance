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
                    out_val = out_entry["value"]
                    in_val = in_entry["value"]
                    link_value = max(out_val, in_val)  # display the larger value for flow width
                    links.append({
                        "source": out_entry["unit"],
                        "target": in_entry["unit"],
                        "value": link_value,
                        "product": product,
                        "output_value": out_val,
                        "input_value": in_val,
                        "loss": round(out_val - in_val, 2),
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

    # Aggregate duplicate links between same source->target pair
    # d3-sankey doesn't handle multiple links between same nodes well
    agg_links = {}
    detail_links = []  # keep individual product links for tooltip/losses
    for link in links:
        if link["source"] not in node_ids or link["target"] not in node_ids:
            continue
        src_idx = node_ids.index(link["source"])
        tgt_idx = node_ids.index(link["target"])
        key = (src_idx, tgt_idx)
        out_val = link.get("output_value", link["value"])
        in_val = link.get("input_value", 0)
        loss_val = link.get("loss", 0)
        detail_links.append({
            "source": src_idx,
            "target": tgt_idx,
            "value": link["value"],
            "product": link["product"],
            "output_value": out_val,
            "input_value": in_val,
            "loss": loss_val,
            "source_name": nodes[link["source"]]["name"],
            "target_name": nodes[link["target"]]["name"],
        })
        if key not in agg_links:
            agg_links[key] = {
                "source": src_idx,
                "target": tgt_idx,
                "value": link["value"],
                "products": [link["product"]],
                "product": link["product"],
                "output_value": out_val,
                "input_value": in_val,
                "loss": loss_val,
                "source_name": nodes[link["source"]]["name"],
                "target_name": nodes[link["target"]]["name"],
            }
        else:
            agg = agg_links[key]
            agg["value"] += link["value"]
            agg["output_value"] += out_val
            agg["input_value"] += in_val
            agg["loss"] += loss_val
            agg["products"].append(link["product"])
            agg["product"] = ", ".join(agg["products"][:3])
            if len(agg["products"]) > 3:
                agg["product"] += f" (+{len(agg['products']) - 3})"

    indexed_links = []
    for agg in agg_links.values():
        indexed_links.append({
            "source": agg["source"],
            "target": agg["target"],
            "value": agg["value"],
            "product": agg["product"],
            "output_value": agg["output_value"],
            "input_value": agg["input_value"],
            "loss": round(agg["loss"], 2),
            "source_name": agg["source_name"],
            "target_name": agg["target_name"],
            "product_count": len(agg["products"]),
        })

    losses_table = []
    for dl in detail_links:
        loss_val = dl.get("loss", 0)
        if loss_val != 0:
            out_val = dl.get("output_value", dl["value"])
            loss_pct = abs(loss_val) / out_val * 100 if out_val > 0 else 0
            losses_table.append({
                "source": dl["source_name"],
                "target": dl["target_name"],
                "product": dl["product"],
                "output_value": round(out_val, 2),
                "input_value": round(dl.get("input_value", 0), 2),
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
