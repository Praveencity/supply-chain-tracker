import heapq
import math

CITIES = {
    "New York": [40.7128, -74.0060],
    "Chicago": [41.8781, -87.6298],
    "Miami": [25.7617, -80.1918],
    "Dallas": [32.7767, -96.7970],
    "Denver": [39.7392, -104.9903],
    "Los Angeles": [34.0522, -118.2437],
    "San Francisco": [37.7749, -122.4194],
    "Seattle": [47.6062, -122.3321],
    "Atlanta": [33.7490, -84.3880],
    "Phoenix": [33.4484, -112.0740],
    "Minneapolis": [44.9778, -93.2650],
    "Boston": [42.3601, -71.0589],
    "Houston": [29.7604, -95.3698],
    "Philadelphia": [39.9526, -75.1652],
    "San Diego": [32.7157, -117.1611],
    "Detroit": [42.3314, -83.0458],
    "Portland": [45.5152, -122.6784],
    "Las Vegas": [36.1699, -115.1398],
    "Salt Lake City": [40.7608, -111.8910],
    "Charlotte": [35.2271, -80.8431],
    "Kansas City": [39.0997, -94.5786],
    "Indianapolis": [39.7684, -86.1581],
    "Nashville": [36.1627, -86.7816],
    "New Orleans": [29.9511, -90.0715],
    "Washington, DC": [38.9072, -77.0369]
}

CONNECTIONS = [
    ("New York", "Boston"), ("New York", "Chicago"), ("New York", "Atlanta"),
    ("Chicago", "Minneapolis"), ("Chicago", "Denver"), ("Chicago", "Atlanta"),
    ("Atlanta", "Miami"), ("Atlanta", "Dallas"),
    ("Dallas", "Phoenix"), ("Dallas", "Denver"),
    ("Minneapolis", "Denver"), ("Minneapolis", "Seattle"),
    ("Denver", "Phoenix"), ("Denver", "San Francisco"),
    ("Phoenix", "Los Angeles"),
    ("Los Angeles", "San Francisco"),
    ("San Francisco", "Seattle"),
    ("Washington, DC", "New York"), ("Washington, DC", "Philadelphia"), ("Washington, DC", "Charlotte"),
    ("Philadelphia", "New York"),
    ("Charlotte", "Atlanta"), ("Charlotte", "Nashville"),
    ("Nashville", "Atlanta"), ("Nashville", "Indianapolis"),
    ("Indianapolis", "Chicago"), ("Indianapolis", "Detroit"),
    ("Detroit", "Chicago"),
    ("Kansas City", "Chicago"), ("Kansas City", "Denver"), ("Kansas City", "Dallas"),
    ("Houston", "Dallas"), ("Houston", "New Orleans"),
    ("New Orleans", "Atlanta"),
    ("Salt Lake City", "Denver"), ("Salt Lake City", "Las Vegas"), ("Salt Lake City", "San Francisco"),
    ("Las Vegas", "Los Angeles"), ("Las Vegas", "Phoenix"),
    ("San Diego", "Los Angeles"), ("San Diego", "Phoenix"),
    ("Portland", "Seattle"), ("Portland", "San Francisco")
]

GRAPH = {city: {} for city in CITIES}
for u, v in CONNECTIONS:
    y1, x1 = CITIES[u]
    y2, x2 = CITIES[v]
    dist = math.sqrt((y2 - y1)**2 + (x2 - x1)**2)
    GRAPH[u][v] = dist
    GRAPH[v][u] = dist

def dijkstra(start, end):
    queue = [(0, start, [])]
    seen = set()
    mins = {start: 0}
    
    while queue:
        (cost, node, path) = heapq.heappop(queue)
        
        if node not in seen:
            seen.add(node)
            path = path + [node]
            if node == end:
                return cost, path
            
            for next_node, weight in GRAPH.get(node, {}).items():
                if next_node in seen: continue
                prev = mins.get(next_node, None)
                next_cost = cost + weight 
                
                if prev is None or next_cost < prev:
                    mins[next_node] = next_cost
                    heapq.heappush(queue, (next_cost, next_node, path))
                    
    return float("inf"), []
