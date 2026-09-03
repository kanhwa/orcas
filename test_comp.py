import csv
with open("data/processed/2016.csv") as f:
    d1 = list(csv.reader(f))
with open("2014_KLONING_SIAP_UPLOAD.csv") as f:
    d2 = list(csv.reader(f))

d2_mod = []
for r in d2:
    row = list(r)
    row[0] = "2016"
    d2_mod.append(row)

print("Same:", d1 == d2_mod)
