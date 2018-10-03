pragma solidity ^0.4.24;

import {ERC721Token} from "openzeppelin-solidity/contracts/token/ERC721/ERC721Token.sol";
import "openzeppelin-solidity/contracts/ECRecovery.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";

contract FlightSeatsGlobalDistributor is ERC721Token("Flight Seat Distributor", "FLIGHT-SEAT"), Pausable {

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
     * Ensure the given message sender is the airline of the flight which contains the seat
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

    /**
     * Ensure the given message sender is the airline of the flight
     */
    modifier onlyAirlineOfFlight(bytes8 _flightNumber, uint _departureDateTime){
        require(getAirlineAddressForFlight(_flightNumber, _departureDateTime) == msg.sender, "Must be airline of the flight");
        _;
    }

    // a struct model for an Airline
    struct Airline {
        bytes2 code;
        string name;
        address airlineAddress;
    }

    // a struct model for a Flight
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

    // a struct model for a Seat
    struct Seat {
        bytes4 seatNumber;
        uint price;
        SeatOccupiedStatus occupiedStatus;
        CabinClass cabin;
        bytes32 flightId;
        bool checkedIn;
        bool isSeat;
    }

    // a struct model for a Boarding Pass
    struct BoardingPass {
        uint256 id;
        uint256 seatId;
        bytes32 barcodeString;
        bytes passportScanIpfsHash;
    }

    // a struct model for a Booking Refund
    struct BookingRefund {
        address recipient;
        uint amount;
        bool paid;
    }

    address[] public activeAirlines; // airlines currently using the system

    mapping(address => bytes32[]) internal flightIds; // airlines to their belonging flightIds

    mapping(bytes32 => Flight) internal flights; // flightIds to flights.

    mapping(uint256 => Seat) internal seats; // seatIds to seats.

    mapping(uint256 => BoardingPass) internal seatBoardingPasses; // seatIds to boarding passes.

    mapping(address => BookingRefund[]) private airlineRefundsToBeProcessed; // airlines to their BookingRefunds to be processed in the future

    mapping(address => uint256) private airlineFlightFeeDeposits; // airlines to their seat booking fees which they can withdraw

    mapping(uint256 => bool) private usedNonces; // nonces to guarantee unique function invocations

    // gets the airlines currently using the system
    function getActiveAirlines() public view returns (address[]) {
        return activeAirlines;
    }

    // gets the flightId for a given flightNumber and _departureDateTime
    function getFlightId(bytes8 _flightNumber, uint _departureDateTime) public pure returns (bytes32){
        return keccak256(abi.encodePacked(_flightNumber, "_", _departureDateTime));
    }

    // gets the seatId for a given flightNumber, _departureDateTime and seatNumber
    function getSeatId(bytes8 _flightNumber, uint _departureDateTime, bytes4 _seatNumber) public pure returns (uint256){
        return uint256(keccak256(abi.encodePacked(_flightNumber, "_", _departureDateTime, "_", _seatNumber)));
    }

    // gets all flightId's belonging to given airline
    function getFlightIdsForAirline(address _airlineAddress) public view returns (bytes32[] memory) {
        return flightIds[_airlineAddress];
    }

    // gets a single Flight based on given flightId
    function getFlight(bytes32 _flightId) public view returns (bytes32,bytes8,bytes3,bytes3,string,uint,bytes2){
        return (flights[_flightId].flightId, flights[_flightId].flightNumber, flights[_flightId].origin, flights[_flightId].destination, flights[_flightId].airline.name, flights[_flightId].departureDateTime, flights[_flightId].airline.code);
    }

    // gets a single Seat based on given seatId
    function getSeat(uint256 _seatId) public view returns(uint, bytes4, uint, SeatOccupiedStatus, CabinClass, bool, bool) {
        return (_seatId, seats[_seatId].seatNumber, seats[_seatId].price, seats[_seatId].occupiedStatus, seats[_seatId].cabin, seats[_seatId].checkedIn, seats[_seatId].isSeat);
    }

    // gets all seatId's belonging to given flight
    function getSeatsForFlight(bytes32 _flightId) public view returns (uint256[]){
        return flights[_flightId].seatIds;
    }

    // get the flight which contains a given seatId
    function getFlightOfSeat(uint256 _seatId) private view returns (Flight){
        return flights[seats[_seatId].flightId];
    }

    // get the airline who owns the flight containing the given seatId
    function getAirlineAddressForSeat(uint _seatId) private view returns (address){
        return flights[seats[_seatId].flightId].airline.airlineAddress;
    }

    // get the airline who owns the flight
    function getAirlineAddressForFlight(bytes8 _flightNumber, uint _departureDateTime) private view returns (address){
        return flights[getFlightId(_flightNumber, _departureDateTime)].airline.airlineAddress;
    }

    // get the boarding pass for a given seat id
    function getBoardingPassForSeat(uint _seatId) public view returns (uint256, uint256, bytes32, bytes) {
        return(seatBoardingPasses[_seatId].id, seatBoardingPasses[_seatId].seatId, seatBoardingPasses[_seatId].barcodeString, seatBoardingPasses[_seatId].passportScanIpfsHash);
    }

    event SeatCreatedEvent (
        bytes32 flightId,
        bytes4 seatNumber,
        uint256 seatId
    );

    event SeatBookedEvent (
        address indexed seatOwner,
        uint256 indexed seatId,
        bytes8 flightNumber,
        uint departureDateTime,
        bytes3 origin,
        bytes3 destination,
        bytes4 seatNumber
    );

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

    event FlightFeeDeposited(address indexed airline, uint256 weiAmount);
    event FlightFeesWithdrawn(address indexed airline, uint256 weiAmount);
    event RefundProcessedEvent(address indexed airline, address indexed recipient, uint256 weiAmount);


    /**
     * @dev Constructor function, creates a single flight for demo purposes, and pre-populates this single flight with seat inventory for 3 cabins.
     */
    constructor() public {
        createFlight(0x4241313235000000,0x4c4852,0x4a464b,1543734893,0x4241,"British Airways",6,owner,abi.encodePacked(""),555);

        bytes4[] memory _seatNumbersPrepopulated = new bytes4[](2);
        uint256[] memory _seatPricesPrepopulated = new uint256[](2);

        _seatNumbersPrepopulated[0] = 0x31410000;
        _seatNumbersPrepopulated[1] = 0x31420000;

        _seatPricesPrepopulated[0] = 10000000000000000000;
        _seatPricesPrepopulated[1] = 9000000000000000000;

        addSeatInventoryToFlightCabin(0x4241313235000000, 1543734893, _seatNumbersPrepopulated, _seatPricesPrepopulated,CabinClass.First);

        _seatNumbersPrepopulated[0] = 0x32410000;
        _seatNumbersPrepopulated[1] = 0x32420000;

        _seatPricesPrepopulated[0] = 6000000000000000000;
        _seatPricesPrepopulated[1] = 5000000000000000000;

        addSeatInventoryToFlightCabin(0x4241313235000000, 1543734893, _seatNumbersPrepopulated, _seatPricesPrepopulated,CabinClass.Business);

        _seatNumbersPrepopulated[0] = 0x33410000;
        _seatNumbersPrepopulated[1] = 0x33420000;

        _seatPricesPrepopulated[0] = 3000000000000000000;
        _seatPricesPrepopulated[1] = 2000000000000000000;

        addSeatInventoryToFlightCabin(0x4241313235000000, 1543734893, _seatNumbersPrepopulated, _seatPricesPrepopulated,CabinClass.Economy);
    }


    /**
     * @dev Initialises a Flight in storage for an airline
     * @param _flightNumber bytes8 of the flight
     * @param _origin bytes3 IATA code for origin airport
     * @param _destination bytes3 IATA code for destination airport
     * @param _departureDateTime uint256 representing the departure dateTime
     * @param _airlineCode bytes2 IATA airline code for the airline
     * @param _airlineName string of the airline
     * @param _totalNumberSeats uint256 to represent total seat count for this flight
     * @param _airlineAddress address of the airline owning this flight
     * @param _signature bytes representing the digital signature from the airline containing flightId, airlineAddress and nonce
     * @param _nonce uint256 nonce to guarantee unique digital signature on each invocation
     * @return bytes32 flight ID of the flight which is used as the key to obtain the Flight model from storage
     */
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
        returns (bytes32)
    {
        require(!usedNonces[_nonce]);
        usedNonces[_nonce] = true;

        bytes32 _flightId = getFlightId(_flightNumber, _departureDateTime);
        bytes32 _expectedSignature = keccak256(abi.encodePacked(_flightId, _airlineAddress, _nonce)).toEthSignedMessageHash();

        if (msg.sender != owner) { // contract owner populates a single flight for demo purposes in the constructor, and gets a pass on the _signature.
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

        return _flightId;
    }


    /**
    * @dev adds seat inventory to a flight, supplying seatNumbers and corresponding seatPrices
    * @param _flightNumber bytes8 of the flight
    * @param _departureDateTime uint256 representing the departure dateTime
    * @param _seatNumbers bytes4[] containing the seat numbers of seats to be added to the flight
    * @param _seatPrices uint256[] containing the seat prices of seats to be added to the flight
    * @param _cabin CabinClass which will contain the newly added seats
    */
    function addSeatInventoryToFlightCabin(
        bytes8 _flightNumber,
        uint256 _departureDateTime,
        bytes4[] _seatNumbers,
        uint256[] _seatPrices,
        CabinClass _cabin
    )
        onlyAirlineOfFlight(_flightNumber, _departureDateTime)
        whenNotPaused
        public
    {
        bytes32 _flightId = getFlightId(_flightNumber, _departureDateTime);
        require((_seatNumbers.length + flights[_flightId].seatIds.length) <= flights[_flightId].totalNumberSeats, "you cannot add more seats than the total number of seats for flight");
        require(_seatNumbers.length == _seatPrices.length, "you must supply a corresponding seat price for each seat number");

        for(uint i=0; i<_seatNumbers.length; i++){
            flights[_flightId].seatIds.push(createSeat(_flightNumber, _departureDateTime, _seatNumbers[i], _seatPrices[i], _cabin));
        }
    }


    /**
    * @dev creates a single seat for seat number and seat price
    * @param _flightNumber bytes8 of the flight
    * @param _departureDateTime uint256 representing the departure dateTime
    * @param _seatNumber bytes4 containing the seat numbers of seats to be added to the flight
    * @param _price uint256 containing the seat prices of seats to be added to the flight
    * @param _cabin CabinClass which will contain the newly added seats
    */
    function  createSeat(
        bytes8 _flightNumber,
        uint _departureDateTime,
        bytes4 _seatNumber,
        uint256 _price,
        CabinClass _cabin
    )
        private returns (uint256)
    {
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


    /**
    * @dev books a seat for a passenger, sets seat state to occupied, takes payment from passenger and deposits the fee for the airline, mints new ERC721 Seat token and sends to passenger.
    * @param _seatId uint256 of the seat which is to be booked
    * @return uint256 _seatId of the seat which has been booked
    */
    function bookSeat(uint256 _seatId)
        whenNotPaused
        public
        payable
        returns (uint256)
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
        depositFlightFeeToAirline(_airlineAddress, msg.value);

        emit SeatBookedEvent(msg.sender, _seatId, getFlightOfSeat(_seatId).flightNumber, getFlightOfSeat(_seatId).departureDateTime, getFlightOfSeat(_seatId).origin, getFlightOfSeat(_seatId).destination, seats[_seatId].seatNumber);

        return _seatId;
    }


    /**
    * @dev deposits seat fee for the airline to withdraw at a later time
    * @param _airline address of the airline
    * @return _amount uint256 to be deposited for airline
    */
    function depositFlightFeeToAirline(address _airline, uint256 _amount) internal {
        airlineFlightFeeDeposits[_airline] = airlineFlightFeeDeposits[_airline] + _amount;

        emit FlightFeeDeposited(_airline, _amount);
    }


    /**
    * @dev allows the airline to withdraw the seat fee deposits
    * @param _airline address of the airline
    */
    function withdrawFlightFees(address _airline) public {
        require(msg.sender == _airline, "Only the airline can withdraw their own fees");

        uint256 payment = airlineFlightFeeDeposits[_airline];
        assert(address(this).balance >= payment);

        airlineFlightFeeDeposits[_airline] = 0;
        _airline.transfer(payment);

        emit FlightFeesWithdrawn(_airline, payment);
    }


    /**
    * @dev checks in a passenger, burns their ERC721 Seat token, mints new ERC721 Boarding Pass token containing QR-code barcode-string and IPFS passport-scan hash
    * @param _seatId uint256 of the seat which is to be booked
    * @return uint256 _seatId of the seat which has been booked
    */
    function checkinPassenger(uint256 _seatId, bytes32 _barcodeString, bytes memory _passportScanIpfsHash)
        onlyPassengerOf(_seatId)
        whenNotPaused
        public
        returns (uint256)
    {
        require(exists(_seatId), "Seat must exist in order to check in");

        Flight memory _flight = getFlightOfSeat(_seatId);

        require(seats[_seatId].checkedIn == false, "Seat is already checked in");
        require(_flight.departureDateTime > now, "Too late to check in, flight has departed");
        require(seats[_seatId].occupiedStatus == SeatOccupiedStatus.Occupied, "Seat must be occupied");

        seats[_seatId].checkedIn = true;

        uint256 _boardingPassId = uint256(keccak256(abi.encodePacked(_barcodeString, "_", _passportScanIpfsHash)));

        _burn(msg.sender, _seatId);
        _mint(msg.sender, _boardingPassId);
        _setTokenURI(_boardingPassId, bytes32ToString(_barcodeString));
        approve(_flight.airline.airlineAddress, _boardingPassId);

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


    // builds a barcode-string to be encoded in a Boarding Pass QRcode containing the salient flight and seat information for a given seatId
    function getBarcodeStringParametersForBoardingPass(uint256 _seatId) public view returns (bytes8, bytes3, bytes3, uint256, bytes4){
        Flight memory _flight = getFlightOfSeat(_seatId);
        return (_flight.flightNumber, _flight.origin, _flight.destination, _flight.departureDateTime, seats[_seatId].seatNumber);
    }


    /**
    * @dev cancels a seat booking for a passenger, returns the ERC721 Seat token to the airline, enqueues a BookingRefund to be processed by the airline at a later time.
    * @param _seatId uint256 of the seat which is to be cancelled
    * @return uint256 _seatId of the seat which has been cancelled
    */
    function cancelSeatBooking(uint256 _seatId)
    onlyAirlineOrPassengerOf(_seatId)
    whenNotPaused
    public
    returns (uint)
    {
        require(exists(_seatId), "Seat must exist in order to cancel seat booking");
        require(seats[_seatId].occupiedStatus == SeatOccupiedStatus.Occupied, "Seat must be occupied");
        require(seats[_seatId].checkedIn == false, "You cannot cancel a booking after checkin is completed");

        seats[_seatId].occupiedStatus = SeatOccupiedStatus.Vacant;

        address _airline = getAirlineAddressForSeat(_seatId);
        address _passenger = ownerOf(_seatId);
        require(_passenger != _airline, "this seat has already been cancelled and returned to the airline");

        BookingRefund memory _refund = BookingRefund({
            recipient: _passenger,
            amount: seats[_seatId].price,
            paid: false
            });

        safeTransferFrom(_passenger, _airline, _seatId);
        airlineRefundsToBeProcessed[_airline].push(_refund);

        return _seatId;
    }


    /**
    * @dev processes airline refunds, takes payment from airline and sends refunds to passengers who are owed, in queued order.
    * @param _amountToRefund uint256 total amount to be refunded by the airline to the next awaiting passengers in this iteration.
    * @param _nonce uint256 to guarantee unique invocations.
    * @param _airlineSig digital signature of airline containing airline address, nonce, amount to be refunded
    */
    function processAirlineRefunds(uint256 _amountToRefund, uint256 _nonce, bytes _airlineSig)
        whenNotPaused
        public
        payable
    {
        require(airlineRefundsToBeProcessed[msg.sender].length > 0, "this airline does not have any refunds to process");
        require(!usedNonces[_nonce], "nonce already used");
        usedNonces[_nonce] = true;
        require(_amountToRefund == msg.value, "amountToRefund does not equal amount sent");

        // Check the signer of the transaction is the correct airline address to prevent replay attacks
        bytes32 airlineSigned = keccak256(abi.encodePacked(msg.sender, _amountToRefund, _nonce)).toEthSignedMessageHash();
        require(airlineSigned.recover(_airlineSig) == msg.sender, "Invalid airline signature, nice try");

        BookingRefund[] storage _refunds = airlineRefundsToBeProcessed[msg.sender];

        for(uint i=0; i<_refunds.length && _refunds[i].amount <= _amountToRefund; i++){
            _refunds[i].recipient.transfer(_refunds[i].amount);
            _amountToRefund -= _refunds[i].amount;
            _refunds[i].paid = true;
            emit RefundProcessedEvent(msg.sender, _refunds[i].recipient, _refunds[i].amount);
        }

        // return excess refund funds to the airline.
        if(_amountToRefund > 0){
            depositFlightFeeToAirline(msg.sender, _amountToRefund);
        }

        //  shift left on the _refunds array and delete to remove all paid
        uint deleted = 0;
        while (_refunds[0].paid == true){
            for(uint j=0 ;j<_refunds.length-1; j++) {
                _refunds[j] =  _refunds[j+1];
            }
            delete _refunds[_refunds.length-1];
            deleted++;
        }
        _refunds.length -= deleted;
    }

    // utility to convert bytes32 to string
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

    // utility to convert uint256 to string
    function uint256ToString (uint256 data) private pure returns (string) {
        bytes memory bytesString = new bytes(32);
        for (uint256 j=0; j<32; j++) {
            byte char = byte(bytes32(data * 2 ** (8 * j)));
            if (char != 0) {
                bytesString[j] = char;
            }
        }
        return string(bytesString);
    }

    // kill contract and return funds to owner
    function kill() public {
        if (msg.sender == owner) selfdestruct(owner);
    }


}
