pragma solidity ^0.4.24;

import {ERC721Token} from "openzeppelin-solidity/contracts/token/ERC721/ERC721Token.sol";
import "openzeppelin-solidity/contracts/ECRecovery.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSeatsGlobalDistributor is ERC721Token("Flight Seat Distributor", "FLIGHT-SEAT"), Pausable {

    using SafeMath for uint256;
    using ECRecovery for bytes32;

    enum CabinClass {Economy, Business, First}
    enum SeatOccupiedStatus {Vacant, Occupied}

    /**
     * Ensure the given message sender is the passenger who owns the seat or the airline of the flight
     */
    modifier onlyAirlineOrPassengerOf(uint256 _seatId) {
        require(getAirlineAddressForSeat(_seatId) == msg.sender || ownerOf(_seatId) == msg.sender, "Must be airline or passenger who owns the seat");
        _;
    }

    /**
     * Ensure the given message sender is the airline of the flight
     */
    modifier onlyAirlineOf(uint256 _seatId) {
        require(getAirlineAddressForSeat(_seatId) == msg.sender, "Must be airline of the flight");
        _;
    }

    /**
     * Ensure the given message sender is the passenger who owns the seat
     */
    modifier onlyPassengerOf(uint256 _seatId) {
        require(ownerOf(_seatId) == msg.sender, "Must be passenger who owns the seat");
        _;
    }

    modifier onlyAirlineOfFlight(bytes8 _flightNumber, uint _departureDateTime){
        require(getAirlineAddressForFlight(_flightNumber, _departureDateTime) == msg.sender, "Must be airline of the flight");
        _;
    }

    struct Airline {
        bytes2 code;
        string name;
        address airlineAddress;
    }

    struct Flight {
        bytes32 flightId;
        bytes8 flightNumber;
        bytes3 origin;
        bytes3 destination;
        Airline airline;
        uint departureDateTime;
        uint totalNumberSeats;
        uint256[] seatIds;
    }

    struct Seat {
        bytes4 seatNumber;
        uint price;
        SeatOccupiedStatus occupiedStatus;
        CabinClass cabin;
        bytes32 flightId;
        bool checkedIn;
        bool isSeat;
    }

    struct BoardingPass {
        uint256 id;
        uint256 seatId;
        bytes32 barcodeString;
        bytes passportScanIpfsHash;
    }

    struct BookingRefund {
        address recipient;
        uint amount;
    }

    address[] public activeAirlines;

    mapping(address => bytes32[]) internal flightIds; // airlines to their belonging flightIds

    mapping(bytes32 => Flight) internal flights; // flightIds to flights.

    mapping(uint256 => Seat) internal seats; // seatIds to seats.

    mapping(uint256 => BoardingPass) internal seatBoardingPasses; // seatIds to boarding passes.

    mapping(address => BookingRefund[]) internal airlineRefundsToBeProcessed;

    mapping(uint256 => bool) usedNonces;

    function getBoardingPassForSeat(uint _seatId) public view returns (uint256, uint256, bytes32, bytes) {
        return(seatBoardingPasses[_seatId].id, seatBoardingPasses[_seatId].seatId, seatBoardingPasses[_seatId].barcodeString, seatBoardingPasses[_seatId].passportScanIpfsHash);
    }

    function getActiveAirlines() public view returns (address[]) {
        return activeAirlines;
    }

    function getFlightId(bytes8 _flightNumber, uint _departureDateTime) public pure returns (bytes32){
        return keccak256(abi.encodePacked(_flightNumber, "_", _departureDateTime));
    }

    function getSeatId(bytes8 _flightNumber, uint _departureDateTime, bytes4 _seatNumber) public pure returns (uint256){
        return uint256(keccak256(abi.encodePacked(_flightNumber, "_", _departureDateTime, "_", _seatNumber)));
    }

    function getFlightIdsForAirline(address _airlineAddress) public view returns (bytes32[] memory) {
        return flightIds[_airlineAddress];
    }

    function getFlight(bytes32 _flightId) public view returns (bytes32,bytes8,bytes3,bytes3,string,uint,bytes2){
        return (flights[_flightId].flightId, flights[_flightId].flightNumber, flights[_flightId].origin, flights[_flightId].destination, flights[_flightId].airline.name, flights[_flightId].departureDateTime, flights[_flightId].airline.code);
    }

    function getSeat(uint256 _seatId) public view returns(uint, bytes4, uint, SeatOccupiedStatus, CabinClass, bool, bool) {
        return (_seatId, seats[_seatId].seatNumber, seats[_seatId].price, seats[_seatId].occupiedStatus, seats[_seatId].cabin, seats[_seatId].checkedIn, seats[_seatId].isSeat);
    }

    function getSeatsForFlight(bytes32 _flightId) public view returns (uint256[]){
        return flights[_flightId].seatIds;
    }

    function getFlightOfSeat(uint256 _seatId) private view returns (Flight){
        return flights[seats[_seatId].flightId];
    }

    function getAirlineAddressForSeat(uint _seatId) private view returns (address){
        return flights[seats[_seatId].flightId].airline.airlineAddress;
    }

    function getAirlineAddressForFlight(bytes8 _flightNumber, uint _departureDateTime) private view returns (address){
        return flights[getFlightId(_flightNumber, _departureDateTime)].airline.airlineAddress;
    }

    constructor() public {
//        bytes8 _flightNumber = 0x4241313235000000;
//        uint _departureDateTime = 1543734893;
//        bytes32 _flightId = getFlightId(_flightNumber, _departureDateTime);
//        bytes32 _expectedSignature = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _flightId));

        createFlight(0x4241313235000000,0x4c4852,0x4a464b,1543734893,0x4241,"British Airways",9,owner,abi.encodePacked(""),555);
//        createFlight(0x444c353535000000,0x4c4852,0x4a464b,1542412800,0x444c,"Delta Airlines",owner,abi.encodePacked(""));

        bytes4[] memory _seatNumbersPrepopulated = new bytes4[](3);
        uint256[] memory _seatPricesPrepopulated = new uint256[](3);

        _seatNumbersPrepopulated[0] = stringToBytes4("1A");
        _seatNumbersPrepopulated[1] = stringToBytes4("1B");
        _seatNumbersPrepopulated[2] = stringToBytes4("1C");

        _seatPricesPrepopulated[0] = 10000000000000000000;
        _seatPricesPrepopulated[1] = 9000000000000000000;
        _seatPricesPrepopulated[2] = 8000000000000000000;
//
        addSeatInventoryToFlightCabin(0x4241313235000000, 1543734893, _seatNumbersPrepopulated, _seatPricesPrepopulated,CabinClass.First);
//        addSeatInventoryToFlightCabin(0x444c353535000000, 1542412800, _seatNumbersPrepopulated, _seatPricesPrepopulated,CabinClass.First);
//
        _seatNumbersPrepopulated[0] = stringToBytes4("2A");
        _seatNumbersPrepopulated[1] = stringToBytes4("2B");
        _seatNumbersPrepopulated[2] = stringToBytes4("2C");

        _seatPricesPrepopulated[0] = 6000000000000000000;
        _seatPricesPrepopulated[1] = 5000000000000000000;
        _seatPricesPrepopulated[2] = 4000000000000000000;
//
        addSeatInventoryToFlightCabin(0x4241313235000000, 1543734893, _seatNumbersPrepopulated, _seatPricesPrepopulated,CabinClass.Business);
//        addSeatInventoryToFlightCabin(0x444c353535000000, 1542412800, _seatNumbersPrepopulated, _seatPricesPrepopulated,CabinClass.Business);

        _seatNumbersPrepopulated[0] = stringToBytes4("3A");
        _seatNumbersPrepopulated[1] = stringToBytes4("3B");
        _seatNumbersPrepopulated[2] = stringToBytes4("3C");

        _seatPricesPrepopulated[0] = 3000000000000000000;
        _seatPricesPrepopulated[1] = 2000000000000000000;
        _seatPricesPrepopulated[2] = 1000000000000000000;
//
        addSeatInventoryToFlightCabin(0x4241313235000000, 1543734893, _seatNumbersPrepopulated, _seatPricesPrepopulated,CabinClass.Economy);
//        addSeatInventoryToFlightCabin(0x444c353535000000, 1542412800, _seatNumbersPrepopulated, _seatPricesPrepopulated,CabinClass.Economy);

   }

    function createFlight(
        bytes8 _flightNumber,
        bytes3 _origin,
        bytes3 _destination,
        uint256 _departureDateTime,
        bytes2 _airlineCode,
        string _airlineName,
        uint256 _totalNumberSeats,
        address _airlineAddress,
        bytes _signature,
        uint256 _nonce
    )
    whenNotPaused
    public
    returns (bytes32) {

        require(!usedNonces[_nonce]);

        bytes32 _flightId = getFlightId(_flightNumber, _departureDateTime);
        bytes32 _expectedSignature = keccak256(abi.encodePacked(_flightId, _airlineAddress, _nonce)).toEthSignedMessageHash();

        if (msg.sender != owner) {
            require(_expectedSignature.recover(_signature) == _airlineAddress, "Invalid signature");
        }
        require(_departureDateTime > now, "Flight has departed");

        Airline memory _airline = Airline({
            code: _airlineCode,
            name: _airlineName,
            airlineAddress: _airlineAddress
            });

        flights[_flightId] = Flight({
            flightId: _flightId,
            flightNumber: _flightNumber,
            origin: _origin,
            destination: _destination,
            airline: _airline,
            departureDateTime: _departureDateTime,
            totalNumberSeats: _totalNumberSeats,
            seatIds: new uint[](0)
            });

        activeAirlines.push(_airlineAddress);
        flightIds[_airlineAddress].push(_flightId);
        usedNonces[_nonce] = true;

        return _flightId;
    }


    function addSeatInventoryToFlightCabin(bytes8 _flightNumber,
        uint _departureDateTime,
        bytes4[] _seatNumbers,
        uint[] _seatPrices,
        CabinClass cabin
    )
    onlyAirlineOfFlight(_flightNumber, _departureDateTime)
    whenNotPaused
    public
    {
        bytes32 _flightId = getFlightId(_flightNumber, _departureDateTime);
        require(flights[_flightId].seatIds.length.add(_seatNumbers.length) <= flights[_flightId].totalNumberSeats, "you cannot add more seats than the total number of seats for flight");
        require(_seatNumbers.length == _seatPrices.length, "you must supply a corresponding seat price for each seat number");

        for(uint i=0; i<_seatNumbers.length; i++){
            flights[_flightId].seatIds.push(createSeat(_flightNumber, _departureDateTime, _seatNumbers[i], _seatPrices[i], cabin));
        }
    }


    function  createSeat(
        bytes8 _flightNumber,
        uint _departureDateTime,
        bytes4 _seatNumber,
        uint _price,
        CabinClass _cabin
    )
    private returns (uint256){
        uint256 _seatId = getSeatId(_flightNumber, _departureDateTime, _seatNumber);
        Seat memory _seat = Seat({
            seatNumber: _seatNumber,
            price: _price,
            occupiedStatus: SeatOccupiedStatus.Vacant,
            cabin: _cabin,
            flightId: getFlightId(_flightNumber, _departureDateTime),
            checkedIn: false,
            isSeat: true
            });

        seats[_seatId] = _seat;

        emit SeatCreatedEvent(getFlightId(_flightNumber, _departureDateTime), _seatNumber, _seatId);
        return _seatId;
    }

    event SeatCreatedEvent (
        bytes32 flightId,
        bytes4 seatNumber,
        uint256 seatId
    );


    // function to book a flight, set seat state to occupied, take payment from passenger and send to airline, mint new seat token and send to passenger.
    function bookSeat(uint256 _seatId)
    whenNotPaused
    public
    payable
    returns (uint)
    {
        require(flights[seats[_seatId].flightId].departureDateTime > now, "Seat no longer available, flight has departed");
        require(seats[_seatId].occupiedStatus == SeatOccupiedStatus.Vacant, "Seat must not be already occupied");

        address _airlineAddress = getAirlineAddressForSeat(_seatId);
        require(msg.value == seats[_seatId].price && _airlineAddress.balance + msg.value >= _airlineAddress.balance, "Passenger must pay amount equal to price of seat");

        seats[_seatId].occupiedStatus = SeatOccupiedStatus.Occupied;

        if(exists(_seatId)){ // seat will already exist if was previously booked/minted and subsequently cancelled. In this case the seat should have been returned to the airline.
            require(ownerOf(_seatId) == _airlineAddress, "Error, cannot book seat, seat already exists but does not belong to airline");
            safeTransferFrom(_airlineAddress, msg.sender, _seatId);
        }
        else{
            _mint(msg.sender, _seatId);
            _setTokenURI(_seatId, uint256ToString(_seatId));
        }

        approve(_airlineAddress, _seatId);
        _airlineAddress.transfer(msg.value); //called last to reduce race-condition vulnerabilities.

        emit SeatBookedEvent(msg.sender, _seatId, getFlightOfSeat(_seatId).flightNumber, getFlightOfSeat(_seatId).departureDateTime, getFlightOfSeat(_seatId).origin, getFlightOfSeat(_seatId).destination, seats[_seatId].seatNumber);

        return _seatId;
    }

    event SeatBookedEvent (
        address indexed seatOwner,
        uint256 indexed seatId,
        bytes8 flightNumber,
        uint departureDateTime,
        bytes3 origin,
        bytes3 destination,
        bytes4 seatNumber
    );


    function checkinPassenger(uint256 _seatId, bytes32 _barcodeString, bytes memory _passportScanIpfsHash)
    onlyPassengerOf(_seatId)
    whenNotPaused
    public
    returns (uint256)
    {
        require(exists(_seatId), "Seat must exist in order to check in");

        Flight memory _flight = getFlightOfSeat(_seatId);

        require(_flight.departureDateTime > now, "Too late to check in, flight has departed");
        require(seats[_seatId].occupiedStatus == SeatOccupiedStatus.Occupied, "Seat must be occupied");
        require(seats[_seatId].checkedIn == false, "Seat is already checked in");

        seats[_seatId].checkedIn = true;
        uint256 _boardingPassId = uint256(keccak256(abi.encodePacked(_barcodeString, "_", _passportScanIpfsHash)));

        _burn(msg.sender, _seatId);
        _mint(msg.sender, _boardingPassId);
        _setTokenURI(_boardingPassId, bytes32ToString(_barcodeString));
        approve(_flight.airline.airlineAddress, uint256(_boardingPassId));

        BoardingPass memory _boardingPass = BoardingPass({
            id: _boardingPassId,
            seatId: _seatId,
            barcodeString: _barcodeString,
            passportScanIpfsHash: _passportScanIpfsHash
        });

        seatBoardingPasses[_seatId] = _boardingPass;
        emitBoardingPassGeneratedEvent(_boardingPass, _flight);

        return _boardingPassId;
    }

    function emitBoardingPassGeneratedEvent(BoardingPass memory _boardingPass, Flight memory _flight) private view {
        emit BoardingPassGeneratedEvent(_boardingPass.id, msg.sender, _boardingPass.seatId, _boardingPass.passportScanIpfsHash, _flight.flightNumber, _flight.departureDateTime, _flight.origin, _flight.destination, seats[_boardingPass.seatId].seatNumber);
    }

    event BoardingPassGeneratedEvent (
        uint256 indexed boardingPassId,
        address indexed boardingPassOwner,
        uint256 indexed seatId,
        bytes passportScanIpfsHash,
        bytes8 flightNumber,
        uint departureDateTime,
        bytes3 origin,
        bytes3 destination,
        bytes4 seatNumber
    );


    function getBarcodeStringParametersForBoardingPass(uint256 _seatId) public view returns (bytes8, bytes3, bytes3, uint256, bytes4){
        Flight memory _flight = getFlightOfSeat(_seatId);
        return (_flight.flightNumber, _flight.origin, _flight.destination, _flight.departureDateTime, seats[_seatId].seatNumber);
    }


    /**
  * Cancel the seat booking and obtain refund for passenger
  */
    function cancelSeatBookingAirlineInitiated(uint256 _seatId)
    onlyAirlineOf(_seatId)
    whenNotPaused
    public
    payable
    returns (uint)
    {
        require(exists(_seatId), "Seat must exist in order to cancel seat booking");
        require(seats[_seatId].occupiedStatus == SeatOccupiedStatus.Occupied, "Seat must be occupied");
        require(msg.value == seats[_seatId].price, "Airline must send correct refund amount for passenger in transaction");

        ownerOf(_seatId).transfer(msg.value);
        safeTransferFrom(ownerOf(_seatId), getAirlineAddressForSeat(_seatId), _seatId);
        seats[_seatId].occupiedStatus = SeatOccupiedStatus.Vacant;


        return _seatId;
    }



    /**
  * Cancel the seat booking and obtain refund for passenger
  */
    function cancelSeatBookingPassengerInitiated(uint256 _seatId)
    onlyPassengerOf(_seatId)
    whenNotPaused
    public
    returns (uint)
    {
        require(exists(_seatId), "Seat must exist in order to cancel seat booking");
        require(seats[_seatId].occupiedStatus == SeatOccupiedStatus.Occupied, "Seat must be occupied");
        require(seats[_seatId].checkedIn == false, "You cannot cancel a booking after checkin is completed");

        safeTransferFrom(msg.sender, getAirlineAddressForSeat(_seatId), _seatId);
        seats[_seatId].occupiedStatus = SeatOccupiedStatus.Vacant;

        BookingRefund memory _refund = BookingRefund({
            recipient: msg.sender,
            amount: seats[_seatId].price
            });

//        airlineRefundsToBeProcessed[getAirlineAddressForSeat(_seatId)].push(_refund);

        return _seatId;
    }


    function kill() public {
        if (msg.sender == owner) selfdestruct(owner); }




    // create function to allow airline to burn expired seats.

    // create distressed inventory reduction
    //    function reducePriceOfVacantSeatsCloseToDeparture(int daysToDeparture, int percentagePriceReduction){
    //
    //    }

    // airlineRefundsToBeProcessed - create function to allow airline to process this queue.


    function stringToBytes4(string memory source) private pure returns (bytes4 result) {
        bytes memory tempEmptyStringTest = bytes(source);
        if (tempEmptyStringTest.length == 0) {
            return 0x0;
        }
        //TODO add some requires for string length etc. see: https://medium.codylamson.com/inter-contract-communication-strings-1fa1e3c9a566
        assembly {
            result := mload(add(source, 32))
        }
    }

    function bytes32ToString (bytes32 data) private pure returns (string) {
        bytes memory bytesString = new bytes(32);
        for (uint j=0; j<32; j++) {
            byte char = byte(bytes32(uint(data) * 2 ** (8 * j)));
            if (char != 0) {
                bytesString[j] = char;
            }
        }
        return string(bytesString);
    }

    function uint256ToString (uint data) private pure returns (string) {
        bytes memory bytesString = new bytes(32);
        for (uint j=0; j<32; j++) {
            byte char = byte(bytes32(data * 2 ** (8 * j)));
            if (char != 0) {
                bytesString[j] = char;
            }
        }
        return string(bytesString);
    }

}
