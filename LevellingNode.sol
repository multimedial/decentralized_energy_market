///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Smart contract for a decentralized energy market
//
//
// author: Christophe Leske 
// info: info@multimedial.de
// created: 24th of apr 2020
//
// Version: 1.0
//
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
pragma solidity ^0.5.0;

contract LevellingNode {
    
      //using strings for *;
    
    // owner of the smart contract
    address owner;
    
    // bookkeeping
    uint totalBuy = 0;
    uint totalSell = 0;

    // list of participatns
    mapping (address => bool) public participants;
    
    // pricelist
    // mapping for normal power price
    mapping (string => int) prices;

    //////////////////////////////////////////////////////////
    // EEG-power prices
    // first entry is timestamp,
    // second is list of prices per energy type
    //////////////////////////////////////////////////////////
    mapping(string => int) buyingPrices;
    
    
    // events
    event logMsg(string msg, int value);
    event logMsg2(string msg, uint value);
    event energyTransaction(address sender, uint amount, int price, int totalAmount);
    event TransactionSuccess(string a);
    event TransactionFailed(string a);
    event getAPrice(string timestamp, int current_energy_price_kwh);
    event hint(address s);
    event setAPrice(string timestamp, int current_energy_price_kwh);
    event setABuyingPrice(string timestamp, int current_energy_price_kwh);
    event getABuyingPrice(string timestamp, int current_energy_price_kwh);

    modifier onlyOwner {
        require(
            msg.sender ==  owner,
            "Sender not authorized."
        );
        _;
    }
    
    
    constructor () public {
        
        // store the owner
        owner = msg.sender;
        prices['normal_sell'] = 11;
        prices['normal_buy'] = 10;

    }
    
    
    function fund() public payable {
       emit logMsg("RECEIVED: ", int(msg.value));
    }
    
    
    function getAccountBalance() public view returns (uint balance){
        return address(this).balance;
    }
    
    
    ///////////////////////////////////////////////////////////////////////////////////////////////////
    // management functions
    ///////////////////////////////////////////////////////////////////////////////////////////////////
    function setPriceForSingleWatt(string memory _timestamp, int _price) public onlyOwner  returns (int price){
        // sets the current energyprice for the given timestamp
        prices[_timestamp] = _price;
        emit setAPrice(_timestamp, _price);
        return getPriceForSingleWatt(_timestamp);
    }

    function getPriceForSingleWatt(string memory _timestamp) public returns (int price) {
        // emit the prices
        int price = prices[_timestamp];
        emit getAPrice(_timestamp, price);
        return price;
    }

    function setBuyingPrice(string memory _timestamp, int _price) public onlyOwner returns (int buyingPrice) {
        buyingPrices[_timestamp] = _price;
        emit setABuyingPrice(_timestamp, buyingPrices[_timestamp]);
        return buyingPrices[_timestamp];
    }

    function getBuyingPrice(string memory _timestamp) public returns (int buyingPrice) {
        int buyingPrice = buyingPrices[_timestamp];
        emit getABuyingPrice(_timestamp, buyingPrice);
        return buyingPrice;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////
    // buy/sell functions
    ///////////////////////////////////////////////////////////////////////////////////////////////////
    function buyEnergy(string memory _timestamp, uint _amountWatt) public payable
    returns (uint amountBought, int eeg_verguetung, int totalAmount) {

        emit logMsg("BLOCKCHAIN: energy market request for buying ", int(_amountWatt));

        if (_amountWatt ==0) {
            emit TransactionFailed("Transaction failed, no amount specified.");
            return (0,0,0);
        }

        int price =buyingPrices[_timestamp];
        emit logMsg("EEG price: ", price);
        // compute total price
        int totalAmount = int(_amountWatt) * price;
        emit logMsg("Total amount payable: ", totalAmount);

        if(address(this).balance>=uint(totalAmount)) {

            msg.sender.call.value( uint(totalAmount) )("");

        } else {
            // not enough funds!

            return (0,0,0);
        }

        totalBuy += _amountWatt;
        emit TransactionSuccess("Transaction suceeded");
        emit energyTransaction(msg.sender, _amountWatt, price, totalAmount);
        emit logMsg("Local balance after sending:", int(address(this).balance));
        emit TransactionFailed("Transaction failed, not enough funds available.");
        return (_amountWatt, price, totalAmount);

    }


    
    function sellEnergy(string memory _timestamp, uint _amountInWatt) public payable returns (uint amountSold, int price, int totalAmount, string memory errorMsg){

        emit logMsg("LEVELNODE: selling energy in Wh: ", int(_amountInWatt));
        emit logMsg("LEVELNODE: amount of money sent in Wei: ", int(msg.value));

        int price = prices[ _timestamp ];
        emit logMsg("LEVELNODE: selling energy (Wh) at price", price);
        int totalAmount = int(_amountInWatt) * price;

        if (totalAmount>0) {
                ////////////////////////////////////////////////////////////////////////////////////////////////////////////
                // normal case, the energy price is positive, this contract has to RECEIVE funds from sender
                ////////////////////////////////////////////////////////////////////////////////////////////////////////////
                if (int(msg.value)<totalAmount) {
                    return (0,0,0, "ERROR: TRANSACTION FAILED: not enough funds were sent." );
                }
                totalSell += _amountInWatt;
        }


        if (totalAmount<0) {
            int realTotalAmount = totalAmount*(-1);
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // unusual case, the energy price is negative - this contract needs to SEND funds to sender
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            //require( msg.value==0, "LEVELNODE: TRANSACTION FAILED: funds were sent, but not needed!" );
            // pay the sender the sum of totalAmount via standard payable function
            require( int(address(this).balance)>realTotalAmount, "ERROR: Levelnode ran out of funds!" );
            emit logMsg("LEVELNODE: sending money because of neg. energy price: ", realTotalAmount);
            msg.sender.call.value(uint(realTotalAmount))("");
        }

        emit energyTransaction(msg.sender, _amountInWatt, price, totalAmount);
        emit TransactionSuccess("LEVELNODE: Transaction suceeded, energy sold, money sent.");
        return (_amountInWatt, price, totalAmount,'');

    }
    
    
    // get account balance
    function getBalance() public onlyOwner view returns (uint256) {
        return address(this).balance;
    }
    
    
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // string concatenation function
    // taken from https://github.com/provable-things/ethereum-api/blob/master/oraclizeAPI_0.5.sol
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /*
    function strConcat(string memory _a, string memory _b) internal pure returns (string memory _concatenatedString) {
        return strConcat(_a, _b, "", "", "");
    }
    
    
    function strConcat(string memory _a, string memory _b, string memory _c) internal pure returns (string memory _concatenatedString) {
        return strConcat(_a, _b, _c, "", "");
    }
    
    
    function strConcat(string memory _a, string memory _b, string memory _c, string memory _d) internal pure returns (string memory _concatenatedString) {
        return strConcat(_a, _b, _c, _d, "");
    }
    
    
    function strConcat(string memory _a, string memory _b, string memory _c, string memory _d, string memory _e) internal pure returns (string memory _concatenatedString) {
        bytes memory _ba = bytes(_a);
        bytes memory _bb = bytes(_b);
        bytes memory _bc = bytes(_c);
        bytes memory _bd = bytes(_d);
        bytes memory _be = bytes(_e);
        string memory abcde = new string(_ba.length + _bb.length + _bc.length + _bd.length + _be.length);
        bytes memory babcde = bytes(abcde);
        uint k = 0;
        uint i = 0;
        for (i = 0; i < _ba.length; i++) {
            babcde[k++] = _ba[i];
        }
        for (i = 0; i < _bb.length; i++) {
            babcde[k++] = _bb[i];
        }
        for (i = 0; i < _bc.length; i++) {
            babcde[k++] = _bc[i];
        }
        for (i = 0; i < _bd.length; i++) {
            babcde[k++] = _bd[i];
        }
        for (i = 0; i < _be.length; i++) {
            babcde[k++] = _be[i];
        }
        return string(babcde);
    }
    */
}
