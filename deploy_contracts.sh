burrow deploy -a B660F446FFC5BED8110246510CA32B55E3D3D6A1 --keys=127.0.0.1:10997 deploy.yaml

SENDER=`jq '.Address' account.json | tr -d '"' `
TARGET=`jq '.consumer' deploy.output.json | tr -d '"' `
AMOUNT=9999999000
burrow tx -v4 --config burrow_seed.toml formulate send -s $SENDER  -t $TARGET -a $AMOUNT > tx.json
burrow tx -v4 --config burrow_seed.toml commit --file tx.json

#SENDER=1BB072B7EA616B7FA2B26AF42060637A05865E2B
#burrow tx -v4 --config burrow_seed.toml formulate send -s $SENDER  -t $TARGET -a $AMOUNT > tx.json
#burrow tx -v4 --config burrow_seed.toml commit --file tx.json


#SENDER=B4E0D89CB749A62AEAF9E934D620BC7785F8C28E
TARGET=`jq '.levelnode' deploy.output.json | tr -d '"' `
#AMOUNT=9999999000
#burrow tx -v4 --config burrow_seed.toml formulate send -s $SENDER  -t $TARGET -a $AMOUNT > tx.json
#burrow tx -v4 --config burrow_seed.toml commit --file tx.json

SENDER=2F8C36C110840291160645771A6345D983AC4016
burrow tx -v4 --config burrow_seed.toml formulate send -s $SENDER  -t $TARGET -a $AMOUNT > tx.json
burrow tx -v4 --config burrow_seed.toml commit --file tx.json
