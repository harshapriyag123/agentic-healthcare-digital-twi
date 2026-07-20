import networkx as nx

from app.models.domain import Hospital


def build_infrastructure_graph(hospitals: list[Hospital]) -> nx.DiGraph:
    graph = nx.DiGraph()
    for hospital in hospitals:
        graph.add_node(hospital.hospital_id, kind="hospital")
        for dependency in hospital.critical_dependencies:
            graph.add_node(dependency, kind="dependency")
            graph.add_edge(dependency, hospital.hospital_id, weight=0.55)
        for neighbor in hospital.referral_neighbors:
            graph.add_edge(hospital.hospital_id, neighbor, weight=0.35)
    return graph


def dependency_pressure(graph: nx.DiGraph, facility_id: str, failed_nodes: set[str]) -> float:
    pressure = 0.0
    for predecessor in graph.predecessors(facility_id):
        if predecessor in failed_nodes:
            pressure += float(graph.edges[predecessor, facility_id].get("weight", 0.3))
    return min(1.0, pressure)


def centrality_scores(graph: nx.DiGraph) -> dict[str, float]:
    raw = nx.pagerank(graph, alpha=0.85)
    hospital_scores = {node: score for node, score in raw.items() if str(node).startswith("HOSP-")}
    max_score = max(hospital_scores.values(), default=1)
    return {node: score / max_score for node, score in hospital_scores.items()}
