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

import "./energysources/EnergySource.sol";
import "./energysources/Solarcell.sol";
import "./energysources/Windturbine.sol";
import "./energysources/Waterturbine.sol";
import "./energysources/Gasturbine.sol";
import "LevellingNode.sol";


contract Consumer {
   
    // address of contract owner
    address owner;
    
    //optional  name of habitat
    string public nameofhabitat = "n/a";
    
    // surface of the habitat
    uint public surface_sqm = 0;
    
    // base consumption of the habitat per square metre
    uint public consumption_per_sqm = 0;
    
    // number of persons in habitat
    uint public nbr_persons = 0;
    
    // consumption per person in habitat
    uint public consumption_per_person = 0;
    
    // ADD the reneweable energy sources
    EnergySource[] public energySources;
    
    bool useBuffer = false;
    uint energyBuffer = 0;
    uint maxEnergyBuffer = 100000;
    
    
    // address of the energyMarketTrader-contract to call
    address public energyMarketAddress;

    string [] names;
    
    event logMsg(string msg, int value);
    
    modifier onlyOwnerOrSmartContract {
        require(
            ( ( msg.sender ==  owner ) || ( msg.sender == address(this) )),
            "Sender not authorized."
        );
        _;
    }

    struct Habitat {
        string nameofhabitat;
        uint surface_sqm;
        uint consumption_per_sqm;
        uint nbr_persons;
        uint consumption_per_person;
        uint max_buffer_size;
        uint current_buffer_level;
    }

    Habitat habitat; //= Habitat("Quartier", 10000, 10, 20, 800, 10, 10);
    

    // Constructor of contract    
    constructor () public {
        ////////////////////////////////////////
        // init  class variables
        ////////////////////////////////////////
        // store owner of contract
        ////////////////////////////////////////
        owner = msg.sender;

    }

    // convenience function for quickly setting the values of the habitat
    function setQuartierConfig(
        string memory _name,
        uint _surface_sqm,
        uint _consumption_per_sqm,
        uint _nbr_persons,
        uint _consumption_per_person,
        uint _max_buffer_size)
    public onlyOwnerOrSmartContract returns (
        string memory nameofhabitat,
        uint surface_sqm,
        uint consumption_per_sqm,
        uint nbr_persons,
        uint consumption_per_person,
        uint current_buffer_level,
        uint max_buffer_size)
    {

        habitat = Habitat( _name, _surface_sqm, _consumption_per_sqm, _nbr_persons, _consumption_per_person,
    _max_buffer_size, _max_buffer_size);
        return getQuartierConfig();

    }

    function getQuartierConfig() public view returns (
        string memory nameofhabitat,
        uint surface_sqm,
        uint consumption_per_sqm,
        uint nbr_persons,
        uint consumption_per_person,
        uint current_buffer_level,
        uint max_buffer_size){

        return (habitat.nameofhabitat,
        habitat.surface_sqm,habitat.consumption_per_sqm, habitat.nbr_persons, habitat.consumption_per_person,
        habitat.current_buffer_level, habitat.max_buffer_size);
    }

    function setNameOfHabitat(string memory _name) public onlyOwnerOrSmartContract{
        nameofhabitat = _name;
    }

    function setSurface(uint _surface) public onlyOwnerOrSmartContract{
        surface_sqm = _surface;
    }

    function setConsumptionpersqm(uint _consumption_per_sqm) public onlyOwnerOrSmartContract{
        consumption_per_sqm = _consumption_per_sqm;
    }

    function setNumberofpersons(uint _nbr_persons) public onlyOwnerOrSmartContract{
        nbr_persons = _nbr_persons;
    }

    function setPersonconsumption(uint _consumption_per_person) public onlyOwnerOrSmartContract{
        consumption_per_person = _consumption_per_person;
    }

    function getAccountBalance() public view returns (uint balance){
        return address(this).balance;
    }

    function addEnergySource(string memory _name, uint _maxpower) public onlyOwnerOrSmartContract returns (bool ok) {

        energySources.push( new EnergySource(_name, 0, _maxpower) );
        return true;

    }

    function setCurrentBufferLevel(uint _level) public onlyOwnerOrSmartContract returns (uint currentLevel) {
        habitat.current_buffer_level = _level;
        return getCurrentBufferLevel();
    }

    function getCurrentBufferLevel() public view onlyOwnerOrSmartContract returns (uint currentLevel) {
        return habitat.current_buffer_level;
    }

    function clearEnergySources() public onlyOwnerOrSmartContract returns (bool ok) {
        delete energySources;
        return true;
    }

    function addEnergySource_(EnergySource.EnergySourceType _energytype, string memory name, uint max) public onlyOwnerOrSmartContract returns (string memory) {
        
        EnergySource newEnergySource;

        // store new energysource
        if (_energytype==EnergySource.EnergySourceType.Solar) {
            newEnergySource = new Solarcell(name, 0, max);
        } else if (_energytype==EnergySource.EnergySourceType.Wind) {
            newEnergySource = new Windturbine(name, 0, max);
        } else if (_energytype==EnergySource.EnergySourceType.Water) {
            newEnergySource = new Waterturbine(name, 0, max);
        } else if (_energytype==EnergySource.EnergySourceType.Gas) {
            newEnergySource = new Gasturbine(name, 0, max);
        } else {
            // energysource not recognized!
            return "ERROR - energy source not recognized!";
        }
        
        energySources.push(newEnergySource);
        
        return name;
        
    }
   
    // DEBUG
    function dumpEnergySources() public {
        for (uint i=0;i< energySources.length;i++) {
            emit logMsg(energySources[i].getName(), int(energySources[i].getMaxOutput()));
        }
    }

    function getNbrOfEnergySources() public view returns (uint nbrofsources) {
        return energySources.length;
    }

    function setEnergySource(uint index, uint power) public onlyOwnerOrSmartContract {
        if (index< energySources.length) {
            energySources[index].setMaxOutput(power);
        }
    }

    function getEnergySources() public view returns (EnergySource[] memory energysources) {
        return energySources;
    }

    function getEnergySource(uint index) public view returns (string memory name, uint power) {
        if(index< energySources.length)
            return ( energySources[index].name(), energySources[index].max_output_kwh() );
    }

    function computeEnergyConsumption() public view returns (uint) {
        // computes the total consumption of habitat
        return (surface_sqm * consumption_per_sqm ) + ( nbr_persons * consumption_per_person );
    }

    function computeEnergyProduction() public returns (uint) {
        
        uint total=0;
        
        for (uint i=0;i< energySources.length;i++) {
            
            uint energyproduced = energySources[i].produceEnergy(1);
            total += energyproduced;
            
            // DEBUG
            emit logMsg( energySources[i].getName(), int(energyproduced));
        }
        
        return total;
        
     }

    function isBufferBeingUsed() public view returns (bool) {
         return useBuffer;
     }

    function useEnergyBuffer(bool _useBuffer) public returns (bool){
         
         if(!useBuffer) {
             return false;
         }

         useBuffer = _useBuffer;
         return true;
         
     }

    function fillBuffer(string memory _timestamp, uint amount) public returns (bool){
         
         if(!useBuffer) {
             return false;
         }


         energyBuffer += amount;
         
         if (energyBuffer>maxEnergyBuffer) {
             uint surplus = energyBuffer-maxEnergyBuffer;
             energyBuffer = maxEnergyBuffer;
             sellEnergy(_timestamp, surplus);
         }
         
         return true;
         
     }

    function getBufferLevel() public view returns (uint) {
         if(!useBuffer) {
             return 0;
         }
         return energyBuffer;
     }

    function setMaxEnergyBuffer(uint amount) public {
         maxEnergyBuffer = amount;
     }

    function getMaxEnergyBuffer() public view returns (uint){
         return maxEnergyBuffer;
     }

    function buyEnergy(string memory _timestamp, uint _amountWatt) public onlyOwnerOrSmartContract returns (
        uint amountBoughtInWatt, int pricePerWatt, int totalAmountInWei, string memory errorMsg) {

        LevellingNode market = LevellingNode(energyMarketAddress);
        int price = market.getPriceForSingleWatt(_timestamp);
        emit logMsg("CONSUMER: buyingEnergy amount in Wh: ", int(_amountWatt));

        int totalAmount = price * int(_amountWatt);

        emit logMsg("CONSUMER buyingEnergy total amount in Wei: ", totalAmount);

        if(totalAmount>0) {
            if(uint(totalAmount)<=address(this).balance) {
                return market.sellEnergy.value(uint(totalAmount))(_timestamp, _amountWatt);
            } else {
                // not enough funds!
                emit logMsg("Not enough funds for buying energy. Needed: ", totalAmount );
                emit logMsg("Available funds: ", int(address(this).balance) );
                return (0,0,0, "Not enough funds!");
            }
        }

        return market.sellEnergy.value(0)(_timestamp, _amountWatt);
    }


    function sellEnergy(string memory _timestamp, uint amountWatt) public onlyOwnerOrSmartContract returns (uint amountSold,
        int price, int totalAmount) {

        emit logMsg("Consumer sellingEnergy ", int(amountWatt));
        LevellingNode market = LevellingNode(energyMarketAddress);
        return market.buyEnergy(_timestamp, amountWatt);

    }

    function registerEnergyMarket(address _energyMarket) public {
        energyMarketAddress = _energyMarket;
    }

    function dumpEnergyMarket() public view returns (address){
        return energyMarketAddress;
    }

    // receive function

    event Received(address, uint);
    event Fallback(address, uint);

    function() external payable{}

    function receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    function fallback() external payable {
        emit Fallback(msg.sender, msg.value);
    }
}

