import json,sys,collections
R=json.load(open(sys.argv[1],encoding='utf8'))
for kind in ('pos','neg','sw','nm'):
    S=[x for x in R if x['kind']==kind]
    for var in ('base','P4','P8'):
        c=collections.Counter()
        for x in S:
            ks=range(x['n']) if kind=='pos' else [x['j']]
            for k in ks:
                v=x['rec'][var]['rl'][k]; c['rl_'+str(v)]+=1; u=x['rec'][var]['cu'][k]; c['cu_'+str(u)]+=1
        print(kind,var,dict(c))
# pos words whose verdict differs base vs P8
d=sum(1 for x in R if x['kind']=='pos' for k in range(x['n']) if x['rec']['base']['rl'][k]!=x['rec']['P8']['rl'][k]); print('pos rl word diffs base vs P8',d)
d=sum(1 for x in R if x['kind']=='pos' for k in range(x['n']) if x['rec']['base']['cu'][k]!=x['rec']['P8']['cu'][k]); print('pos cu diffs',d)
