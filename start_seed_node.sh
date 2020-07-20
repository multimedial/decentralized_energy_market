pkill burrow
rm -rf .burrow_seed/burrow_state.db/
rm -rf .burrow_seed/data
rm -rf .burrow_seed/config/addrbook.json
rm ./burrow_seed.log
touch burrow_seed.log
burrow start -v4 --config=burrow_seed.toml &
tail -f burrow_seed.log | jq .message --unbuffered
