"""Sankey Builder — граф потоков между установками."""
from typing import Dict, List, Optional, Set
from datetime import date


def build_sankey(store, target_date: date, data_type: str = "reconciled") -> Dict:
    """Build Sankey for a single date (backwards compat)."""
    return build_sankey_multi(store, [target_date], data_type)


def build_sankey_multi(store, target_dates: List[date], data_type: str = "reconciled",
                       unit_filter: Optional[Set[str]] = None) -> Dict:
    """Build Sankey graph aggregated over multiple dates."""
    suffix = "_meas" if data_type == "measured" else "_recon"

    nodes = {}
    # product -> unit -> total value
    all_outputs = {}
    all_inputs = {}

    for code, unit_info in store.units.items():
        if unit_filter and code not in unit_filter:
            continue
        unit_data = unit_info["data"]
        unit_dates = unit_info["dates"]

        has_data = False
        for td in target_dates:
            if td not in unit_dates:
                continue
            ds = td.strftime("%Y-%m-%d")
            col = f"{ds}{suffix}"

            if unit_data["outputs"] is not None and col in unit_data["outputs"].columns:
                for _, row in unit_data["outputs"].iterrows():
                    product = row["product"]
                    value = float(row[col]) if row[col] else 0.0
                    if value > 0:
                        has_data = True
                        key = (product, code)
                        all_outputs[key] = all_outputs.get(key, 0) + value

            if unit_data["inputs"] is not None and col in unit_data["inputs"].columns:
                for _, row in unit_data["inputs"].iterrows():
                    product = row["product"]
                    value = float(row[col]) if row[col] else 0.0
                    if value > 0:
                        has_data = True
                        key = (product, code)
                        all_inputs[key] = all_inputs.get(key, 0) + value

        if has_data:
            nodes[code] = {"id": code, "name": unit_info["name"], "type": "unit"}

    # Restructure: product -> [{unit, value}, ...]
    outputs_by_product = {}
    for (product, unit), value in all_outputs.items():
        outputs_by_product.setdefault(product, []).append({"unit": unit, "unit_name": nodes.get(unit, {}).get("name", unit), "value": value})

    inputs_by_product = {}
    for (product, unit), value in all_inputs.items():
        inputs_by_product.setdefault(product, []).append({"unit": unit, "unit_name": nodes.get(unit, {}).get("name", unit), "value": value})

    links = []
    matched_outputs = set()
    matched_inputs = set()

    for product in outputs_by_product:
        if product in inputs_by_product:
            for out_entry in outputs_by_product[product]:
                for in_entry in inputs_by_product[product]:
                    if out_entry["unit"] == in_entry["unit"]:
                        continue
                    out_val = out_entry["value"]
                    in_val = in_entry["value"]
                    links.append({
                        "source": out_entry["unit"],
                        "target": in_entry["unit"],
                        "value": max(out_val, in_val),
                        "product": product,
                        "output_value": out_val,
                        "input_value": in_val,
                        "loss": round(out_val - in_val, 2),
                    })
                    matched_outputs.add((product, out_entry["unit"]))
                    matched_inputs.add((product, in_entry["unit"]))

    for product, entries in outputs_by_product.items():
        for entry in entries:
            if (product, entry["unit"]) not in matched_outputs:
                ext_id = f"ext_out_{product}"
                if ext_id not in nodes:
                    nodes[ext_id] = {"id": ext_id, "name": product, "type": "external_output"}
                links.append({"source": entry["unit"], "target": ext_id, "value": entry["value"], "product": product, "input_value": 0, "loss": 0})

    for product, entries in inputs_by_product.items():
        for entry in entries:
            if (product, entry["unit"]) not in matched_inputs:
                ext_id = f"ext_in_{product}"
                if ext_id not in nodes:
                    nodes[ext_id] = {"id": ext_id, "name": product, "type": "external_input"}
                links.append({"source": ext_id, "target": entry["unit"], "value": entry["value"], "product": product, "input_value": entry["value"], "loss": 0})

    node_list = list(nodes.values())
    node_ids = [n["id"] for n in node_list]

    # Aggregate duplicate links
    agg_links = {}
    detail_links = []
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
            "source": src_idx, "target": tgt_idx, "value": link["value"],
            "product": link["product"], "output_value": out_val, "input_value": in_val,
            "loss": loss_val, "source_name": nodes[link["source"]]["name"],
            "target_name": nodes[link["target"]]["name"],
        })
        if key not in agg_links:
            agg_links[key] = {
                "source": src_idx, "target": tgt_idx, "value": link["value"],
                "products": [link["product"]], "product": link["product"],
                "output_value": out_val, "input_value": in_val, "loss": loss_val,
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
            "source": agg["source"], "target": agg["target"], "value": agg["value"],
            "product": agg["product"], "output_value": agg["output_value"],
            "input_value": agg["input_value"], "loss": round(agg["loss"], 2),
            "source_name": agg["source_name"], "target_name": agg["target_name"],
            "product_count": len(agg["products"]),
        })

    losses_table = []
    for dl in detail_links:
        loss_val = dl.get("loss", 0)
        if loss_val != 0:
            out_val = dl.get("output_value", dl["value"])
            loss_pct = abs(loss_val) / out_val * 100 if out_val > 0 else 0
            losses_table.append({
                "source": dl["source_name"], "target": dl["target_name"],
                "product": dl["product"], "output_value": round(out_val, 2),
                "input_value": round(dl.get("input_value", 0), 2),
                "loss": round(loss_val, 2), "loss_pct": round(loss_pct, 2),
            })

    date_label = target_dates[0].isoformat() if len(target_dates) == 1 else f"{target_dates[0].isoformat()} — {target_dates[-1].isoformat()}"

    return {
        "nodes": node_list, "links": indexed_links, "losses": losses_table,
        "date": date_label, "data_type": data_type, "days_count": len(target_dates),
    }
