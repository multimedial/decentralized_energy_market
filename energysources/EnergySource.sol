pragma solidity >=0.4.22 <0.7.0;

contract EnergySource {
    
    enum EnergySourceType { Unknown, Solar, Wind, Water, Gas }
    
    // abstract contract fpr an energy EnergySource
    string name = "n.a.";
    
    uint min_output_kwh = 0;
    uint max_output_kwh = 0;
    
    uint8 damage = 0;

    EnergySourceType public energysourcetype = EnergySourceType.Unknown;
    
    // timeslice?
    uint output_kwh = 0;
    
    uint[] recordedData;
    uint ticker = 0;
    
    event logMsg(string, uint);
    
    
    constructor( string memory _name, uint _min_output_kwh, uint _max_output_kwh ) public {
        
        // store everything
        name = _name;
        min_output_kwh = _min_output_kwh;
        max_output_kwh = _max_output_kwh;

    }
    
    
    function returnAddress() public returns (address) {
        return address(this);
    }
    
    
    function setData(uint[] memory _data) public {
        recordedData = _data;
    }
    
    
    function resetTicker() public {
        setTicker(0);
        emit logMsg("Step is ", ticker);
    }
    
    
    function setTicker(uint _pos) public {
        ticker = _pos % recordedData.length;
    }
    
    
    function tick() public {
        
        ticker = ticker % recordedData.length;
        
        emit logMsg("Step ", ticker);
        emit logMsg("StepData ", uint(recordedData[ticker]));
        
        produceEnergy_external(recordedData[ticker]);
        
        ticker++;
        
    }
    
    
    function produceEnergy(uint factor) public returns (uint256) {
    
        output_kwh = 0;

        if (factor>=0 && factor<=10) {
            output_kwh = ( factor * ((max_output_kwh - min_output_kwh)*10) + min_output_kwh*10 ) / 10 ;
        }
        return output_kwh*(100-damage)/100;
    }
    
    
    function produceEnergy_external(uint value) public returns (uint256) {
        
        output_kwh = value;
        return output_kwh*(100-damage)/100;
        
    }
    
    
    
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // damage functions (get/set)    
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    function setDamage(uint8 _damage) public {
        if (damage>0 && damage <101) {
            damage = _damage;    
        }
     }
    
    
    function getDamage() public view returns (uint8) {
        return damage;
    }
    
    
    function getName() public view returns (string memory) {
        return name;
    }
    
    
    function getMinOutput() public view returns (uint) {
        return min_output_kwh;
    }
    
    
    function getMaxOutput() public view returns (uint) {
        return max_output_kwh;
    }
    
}