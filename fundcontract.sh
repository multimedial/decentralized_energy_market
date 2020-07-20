SENDER=`jq '.Address' account.json | tr -d '"' `
TARGET=`jq '.consumer' deploy.output.json | tr -d '"' `
AMOUNT=100000000
burrow tx -v4 --config burrow_seed.toml formulate send -s $SENDER  -t $TARGET -a $AMOUNT > tx.json
burrow tx -v4 --config burrow_seed.toml commit --file tx.json

TARGET=`jq '.levelnode' deploy.output.json | tr -d '"' `
amount=50000000
burrow tx -v4 --config burrow_seed.toml formulate send -s $SENDER  -t $TARGET -a $AMOUNT > tx.json
burrow tx -v4 --config burrow_seed.toml commit --file tx.json
