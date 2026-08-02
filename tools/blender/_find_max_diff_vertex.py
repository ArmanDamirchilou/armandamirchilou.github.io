import bpy

body = bpy.data.objects.get("avaturn_body")
mesh = body.data
sk = mesh.shape_keys.key_blocks['jawOpen']
bas = mesh.shape_keys.key_blocks['Basis']

diffs = [(sk.data[i].co - bas.data[i].co).length for i in range(len(bas.data))]
max_d = max(diffs)
max_i = diffs.index(max_d)
print('max diff', max_d, 'at vertex', max_i)
print('basis co of that vertex:', bas.data[max_i].co)
print('jawOpen co of that vertex:', sk.data[max_i].co)

# top 10 biggest movers, sorted, with coords
idx_sorted = sorted(range(len(diffs)), key=lambda i: -diffs[i])[:15]
for i in idx_sorted:
    print(f"  v{i}: diff={diffs[i]:.4f} basis_co={tuple(round(c,4) for c in bas.data[i].co)}")

# how many total moved > 1mm
n_moved = sum(1 for d in diffs if d > 0.001)
print('num vertices moved > 1mm:', n_moved)
