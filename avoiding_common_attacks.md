# Security Measures Taken To Avoid Common Attacks

## Reentrancy / Cross-Function Race Conditions

Care is taken to perform all internal work before transferring any newly minted ERC721 tokens at the end of functions.

Additionally, enums are used to lock down the value-set for seat state-transitions, and these state transitions are used to block against reentrancy in both ``bookSeat()`` and ``cancelSeat()`` through ``require`` assertions on the seat state. For example reentrancy is not possible in ``cancelSeatBooking()`` because the function immediately sets ```seat.occupiedStatus = SeatOccupiedStatus.Vacant``` and simulatenously ``require`` the seat to be occupied in oder to perform a cancellation.
```javascript
require(exists(_seatId), "Seat must exist in order to cancel seat booking");
require(seats[_seatId].occupiedStatus == SeatOccupiedStatus.Occupied, "Seat must be occupied");
require(seats[_seatId].checkedIn == false, "You cannot cancel a booking after checkin is completed");

seats[_seatId].occupiedStatus = SeatOccupiedStatus.Vacant;
        
        .....
		.....

safeTransferFrom(_passenger, _airline, _seatId);
airlineRefundsToBeProcessed[_airline].push(_refund);
```
These seat state transitions early in functions coupled with ``require()`` assertions can also help protect against cross-function race conditions.

## DoS with Block Gas Limit and DoS with unexpected Revert

##### Pull-Payment/Withdrawal-Pattern

When seats are booked the ETH funds from the passenger are not immediately sent to the airline. Instead a pull-payment solution (withdrawal pattern) is used for airlines to withdraw their funds from the seat booking fees. Similarly when seat-bookings are cancelled a ```BookingRefund``` is enqueued. The booking refunds are then processed later through airline invocation of ``processAirlineRefunds()``. These pull-payment measures protect against DoS with Block Gas Limit and DoS with unexpected Revert exploits.

Also the project avoids looping over arrays of unknown size to further mitigate this risk.

## Replay Attacks

As mentioned, when Seats are cancelled BookingRefunds are persisted in storage to be processed in queue-like fashion when the airline invokes ``processAirlineRefunds()``. This public function ``processAirlineRefunds()`` would be an ideal target for a replay attack attempt. To protect against replays - the ``processAirlineRefunds()`` function validates the airline's digital signature which contains the ``airlineAddress``, ``amountToRefund`` and ``nonce``. The nonce must be unique on each invocation, previous nonces are stored and checked:
```javascript
require(airlineRefundsToBeProcessed[msg.sender].length > 0, "this airline does not have any refunds to process");
require(!usedNonces[_nonce], "nonce already used");
require(_amountToRefund == msg.value, "amountToRefund does not equal amount sent");

// Check the signer of the offer is the correct airline address to prevent replay attacks
bytes32 airlineSigned = keccak256(abi.encodePacked(msg.sender, _amountToRefund, _nonce)).toEthSignedMessageHash();
require(airlineSigned.recover(_airlineSig) == msg.sender, "Invalid airline signature, nice try");
```

Additionally the ``createFlight()`` function validates an airline's digital signature which contains the flight id, airline address and nonce, requiring that the nonce be unique for security purposes.


## Integer Over/Under-Flow

Checks for overflows are present when performing arithmetic operations on uint256, for example in bookSeat()

```javascript
require(msg.value == seats[_seatId].price && _airlineAddress.balance + msg.value >= _airlineAddress.balance, "Passenger must pay amount equal to price of seat");
```

## General Security Precautions.

Judicious use of access modifiers are used on all public functions to ensure only the authorised operator can invoke the function. For example access modifiers are used to ensure that only the passenger who owns the ERC721 Seat can checkin for the flight, and only the passenger or airline can cancel a seat booking.


## ERC721 Boarding Pass.

As described in design patterns, to generate a ERC721 Boarding Pass the passenger passes the ``seatId``, ``barcodeString`` and ``passportScanIpfsHash`` to the checkin function. The barcodeString is retrieved from the contract in the web layer prior to invoking ``checkinPassenger()``, and this ``barcodeString`` contains all salient boarding pass information; flightNumber-origin-destination-departureDateTime-seatNumber. The QR-code on the passenger's boarding pass will be a 2D-barcode encoding of this ``barcodeString``.

```javascript
uint256 _boardingPassId = uint256(keccak256(abi.encodePacked(_barcodeString, "_", _passportScanIpfsHash)));
_burn(msg.sender, _seatId); 	// burns the ERC721 Seat
_mint(msg.sender, _boardingPassId);	// mints a new ERC721 Boarding Pass
```   

This combination of ``barcodeString`` and ``passportScanIpfs`` uniquely ties the passenger to this boarding pass, which is itself a ERC721 digital bearer instrument which only the passenger should possess. This provides greater security than current boarding pass implementations. It allows airport security to validate the passport/boarding pass association at the departures lounge entry rather than waiting for the airline to properly check at the departures gate. Currently anybody can mock up a boarding pass image and present at the departures lounge entry.


