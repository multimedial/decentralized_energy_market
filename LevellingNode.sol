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
pragma solidity >=0.4.26 <0.7.0;
pragma experimental ABIEncoderV2;

//import "./strings.sol";

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
    mapping (string => int) public prices;
    string[] priceKeys;
    
    struct PriceList {
        string name;
        int price;
    }
    
    
    // events
    event logMsg(string, int);
    event energyTransaction(address, string, uint, string, int);
    event TransactionSuccess(string);
    event TransactionFailed(string);

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
        
    }
    
    
    function fund() public payable {
       emit logMsg("RECEIVED: ", int(msg.value));
    }
    
    
    function getAccountBalance() public view returns (uint){
        return address(this).balance;
    }
    
    
    ///////////////////////////////////////////////////////////////////////////////////////////////////
    // management functions
    ///////////////////////////////////////////////////////////////////////////////////////////////////
    function setPrice(string memory _pricetype, int _price) public onlyOwner {
        
        if (prices[_pricetype] == 0) {
            priceKeys.push(_pricetype);
        } 
        prices[_pricetype] = _price;

    }
    
    
    function getPrice(string memory _pricetype) public view returns (uint256, uint256) {
        
        string memory keyBuy = strConcat( _pricetype, "_buy" );
        string memory keySell = strConcat( _pricetype, "_sell" );
        return (uint(prices[keyBuy]),  uint(prices[keySell]));
    }
    
    
    function getListOfPrices() public view returns (PriceList[] memory) {
        
        PriceList[] memory listOfPrices = new PriceList[](priceKeys.length);
        
        for (uint i=0;i<priceKeys.length;i++) {
            listOfPrices[i] = PriceList(priceKeys[i], prices[priceKeys[i]]);
        }
        
        return listOfPrices;
        
    }
    
    
    ///////////////////////////////////////////////////////////////////////////////////////////////////
    // buy/sell functions
    ///////////////////////////////////////////////////////////////////////////////////////////////////
    function buyEnergy(string memory energyType, uint amountEnergy) public  returns (uint){
        
        address sender = msg.sender;
        string memory key = strConcat( energyType, "_buy" );
        int price = prices[key];
        
        require( price != 0 , strConcat("Unknown energy type: '", energyType,"' -- no price available.") );
        
        // compute total price
        uint totalAmount = amountEnergy * uint(price);
        
        uint dummy = 0;
        
        if (totalAmount>dummy) {
            // we are good! Transaction can happen!

            // how to get the amount of energy being sold?
            //sender.call.gas(1000000).value(1 ether)("register");
            
            // transfer money into account of sellEnergy
            emit TransactionSuccess("Transaction suceeded");
            emit energyTransaction(sender, " bought ", amountEnergy, " at ", price);
            
            totalBuy += amountEnergy;
            
            return amountEnergy;
        }
        
    }
    
    
    function sellEnergy(string memory energyType, uint amount) public payable returns (uint){
        
        string memory priceKey = strConcat( energyType, "_sell" );
        int price = prices[ priceKey ];
        
        require( price != 0, 
                strConcat("Selling transaction failed, no price available for energytype ", energyType) );
        
         // compute total price
        uint totalAmount = amount * uint(price);
        
        require( msg.value>=totalAmount, 
                "Not enough funds sent." );
        
        // transfer money into account of sellEnergy
        emit TransactionSuccess("Transaction suceeded");
        emit energyTransaction(msg.sender, " sold ", amount, " at ", prices [priceKey]);
        
        totalSell += amount;
        
        return amount;
        

    }
    
    
    // get account balance
    function getBalance() public onlyOwner view returns (uint256) {
        return address(this).balance;
    }
    
    
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // string concatenation function
    // taken from https://github.com/provable-things/ethereum-api/blob/master/oraclizeAPI_0.5.sol
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  
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
    
}
