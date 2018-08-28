# Design Decisions

As outlined in the [README](README.md), the primary design decision is to use the ERC721 token standard for Non-Fungible Tokens NFT to model flight seats and boarding passes, which are distributed to passengers upon successful completion of booking and checkin web-flows. ERC721 NFTs enable us to create digital bearer-instruments for cryptographic value-assets with distinctive charactersitcs. This token standard is perfectly suited to value-assets like flight seats and boarding passes where each seat has a unique seat number and each boarding pass should be associated with a unique passenger. The benefit of allowing the passenger to hold an ERC721 seat after booking is that it liberates the passenger to potentially sell, trade, swap, or give away their seat before checkin, should the passenger see fit.

To facilitate the minting and distribution of ERC721 NFTs, the primary contract FlightSeatsGlobalDistributor.sol inherits from the OpenZeppelin contract ERC721Token.sol, which is OpenZeppelin's implementation of the ERC721 standard.

# Design Decisions for Airline Functions:

The ``createFlight()`` and ``addSeatInventoryToFlightCabin()`` functions allow the Airline to initiate a flight in contract storage and populate the flight with seat inventory per-cabin. 

FlightIds are constructed by SHA3-hashing the distinctive Flight details of flight-number and departure datetime, and a mapping of ``flightIds`` to ``Flight`` structs is persisted in storage. The benefit of hashing the flight-number/departure-datetime for the ``flightIds`` is that the Flight ID is deterministic and we can calculate the flight ID given any flight-number/departure-date combination. Appropriate-length byte arrays are used to model the flight itinerary details in the ``Flight`` struct to conserve storage space.

The ``createFlight()`` function validates an airline's digital signature which contains the flight id, airline address and nonce, requiring that the nonce be unique for security purposes.

The ``addSeatInventoryToFlightCabin()`` creates ``Seats`` per-cabin. A mapping of ``seatIds`` to ``Seat`` structs is persisted in contract storage. Similar to flightIds - ``seatIds`` are constructed from uniquely identifiable details of the seats to allow for deterministic ID re-creation/discovery. Seat IDs are constructed from ``flightNumber``, ``departureDateTime``, ``seatNumber``.

The ERC721 Seat tokens are not minted until a passenger invokes ``bookSeat()``, as we do not want tokens to exist until the seat has been booked to reduce storage.

When passengers book seats the fees are not immediately pushed to the airline. The seat fee is deposited in a storage mapping to allow the airline to pull the fees, for security purposes. The ``withdrawFlightFees()`` function handles airline fee withdrawals. 

Similarly when Seats are cancelled BookingRefunds are not immediately processed, BookingRefunds are persisted in storage to be processed in queue-like fashion when the airline invokes processAirlineRefunds(), and then the BookingRefunds are removed from storage. The processAirlineRefunds() function validates the airline's digital signature containing airlineAddress, amountToRefund and nonce, to eliminate replay attacks. 

# Design Decisions for Passenger Functions.

### Seat Bookings

The passenger can invoke the ``bookSeat()`` function from the web layer to pay the seat fee and receive a newly-minted ERC721 Seat NFT issued by the airline. When the seats are minted the ERC721 numeric ID for the Seat token is the numeric ``uint256`` representation of the ``bytes32`` seatId hash, allowing for deterministic recreation of token ids based on flightNumber + departureDateTime + seatNumber.

When ERC721 seats are newly minted and sent to the passenger address, the airline address is also set as 'Approved' on the new seat, which means the airline is authorised to transfer this NFT. The ERC721 standard allows for secondary approved operators on the token in addition to the primary token owner. This is important for the airline to retain some degree of control over the ERC721 Seat for the use-case of cancelling a seat-booking, among others.

### Checkin / Boarding Passes.

To checkin for the flight, the passenger invokes the ``checkinPassenger()`` function. The result of this function is that the passengers ERC721 seat will be burned by the airline, and the airline sends the passenger a newly minted ERC721 Boarding Pass NFT. At this point it is a good idea to take the ERC721 Seat NFT out of circulation via burning as the token is no longer needed. The passenger passes the ``seatId``, ``barcodeString`` and ``passportScanIpfsHash`` to the checkin function. The ``barcodeString`` is retrieved from the contract in the web layer prior to invoking ``checkinPassenger()``, and this barcodeString contains all salient boarding pass information; flightNumber-origin-destination-departureDateTime-seatNumber. The QR-code on the passenger's boarding pass will be a 2D-barcode encoding of this ``barcodeString``.

```javascript
uint256 _boardingPassId = uint256(keccak256(abi.encodePacked(_barcodeString, "_", _passportScanIpfsHash)));
_burn(msg.sender, _seatId); 	// burns the ERC721 Seat
_mint(msg.sender, _boardingPassId);	// mints a new ERC721 Boarding Pass
```

This combination of ``barcodeString`` and ``passportScanIpfs`` unqiuely ties the passenger to this boarding pass, which is itself a ERC721 digital bearer instrument which only the passenger should possess. This provides greater security than current boarding pass implementations. It allows airport security to validate the passport/boarding pass association at the departures lounge entry rather than waiting for the airline to properly check at the departures gate. Currently anybody can mock up a boarding pass image and present at the departures lounge entry.

# General design decisions

### Circuit-Breaker / Emergency-Stop
The contract uses the Circuit-Breaker/Emergency-stop design pattern to allow the contract owner to pause invocation of all the public functions which modify contract's state. The contract inherits from OpenZeppelin's Pausable implementation of emergency-pause. This allows us to restrict each public function to ``whenNotPaused``.

### Fail Early and Loud
The fail-early and loud design pattern is used throughout, where ``require()`` conditions make validity assertions at the beginning of each public function. For example when a passenger tries to checkin:

```javascript
require(exists(_seatId), "Seat must exist in order to check in");
require(_flight.departureDateTime > now, "Too late to check in, flight has departed");
require(seats[_seatId].occupiedStatus == SeatOccupiedStatus.Occupied, "Seat must be occupied");
require(seats[_seatId].checkedIn == false, "Seat is already checked in");
```

### Restricted Access
Access is restricted to the contract's state with data structures set to be internal or private. 

Access modifiers are used on public functions to ensure that only the appropriate actor is allowed to call this public function which modifies the contract's state. For example the ``checkinPassenger()`` function uses the access modifier ``onlyPassengerOf(uint256 _seatId)``. Access modifiers employed are as follows:
```javascript
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
 * Ensure the given message sender is the passenger who owns the seat or the airline of the flight
 */
modifier onlyAirlineOfFlight(bytes8 _flightNumber, uint _departureDateTime){
    require(getAirlineAddressForFlight(_flightNumber, _departureDateTime) == msg.sender, "Must be airline of the flight");
    _;
}
```

### Self-destruct
Self-destruct is used to allow the contract owner to terminate the contract with remaining funds sent to contract owner.

### Pull Withdrawals
Withdrawal design-pattern is used for airline fees and passenger refunds to reduce vulnerabilities.

### Enums
Enums are used to track state-transitions, and these are considered in fail-early ``require()`` conditions when relevant, such as ``seat.occupiedStatus``. 

### Events
Events are emitted for important actions, seat bookings, checkins, refunds etc.

# Libraries:

The contract uses the OpenZepellin library ECRecovery to validate digital signatures, for example in processAirlineRefunds:
		
		using ECRecovery for bytes32;
		.....
		.....
		bytes32 airlineSigned = keccak256(abi.encodePacked(msg.sender, _amountToRefund, _nonce)).toEthSignedMessageHash();
        require(airlineSigned.recover(_airlineSig) == msg.sender, "Invalid airline signature, nice try");

Additional OpenZepellin contracts are imported for inheritance to facilitate ``ERC721Token`` and ``Pausable``.

# Stretch Objectives.

### Intregration with IPFS.

During the checkin flow the passenger uploads their passport-scan to IPFS and submits the IPFS hash to the ``checkinPassenger()`` function to construct their ERC721 Boarding Pass NFT which includes this IPFS hash.


