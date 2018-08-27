# Flight Seats Global Distributor

The goal of this project is to re-imagine the flight booking, check-in and boarding pass processes, distributing flight-seats and boarding passes to passengers as ERC721 Non-Fungible Tokens.

The ERC721 Standard is a (draft) standard for creating Non-Fungible Token (NFT) contracts. Non-fungible means not completely interchangeable. Whereas ERC20 tokens are fungible with respect to each unit being identical to every other unit, in contrast ERC721 NFTs enable us to create digital bearer-instruments for cryptographic value-assets with differentiating charactersitcs. This is perfectly suited to value-assets like flight seats and boarding passes where each seat has a unique seat number and each boarding pass should be associated with a unique passenger.

# Rationale

The benefit of allowing the passenger to hold an ERC721 seat after booking is that it liberates the passenger to potentially sell, trade, swap, or give away their seat before checkin, should the passenger see fit. The ERC721 seat is a digital bearer-instrument belonging solely to the passenger. At checkin time the airline then needs to rediscover who is in possession of the seat to facilitate checkin. It is unlikely an airline would wish to distribute all flight-seats in this manner as it would create a possibility for seat-scalping, however airlines designate a subset of each flight's seats for 'flexible' fares, fares with a higher cost but with greater flexibility to cancel-booking, change dates and passenger names without incurring costs. ERC721 Seats are the ultimate flexible seat and airlines may wish to distribute a subset of flight seats in this manner.

Furthermore, airlines are beholden to the big legacy Global Distribution System providers just to distribute their own seat inventory (Sabre, Amadeus, Travelport). The current travel software landscape is a grotesque pornography of rent-seekers and middle-men organisations who are firmly entrenched for legacy reasons, resulting in notoriously low profit margins for the airlines. Opening up a decentralised direct-to-consumer channel for airlines would help to disintermediate these middle-men organisations. 

# This Project 

This project is a proof-of-concept implementation for a decentralised airline Global Distribution System (GDS). It allows airlines to create flights and populate the flights with seat inventory. It allows passengers to book seats and receive ERC721 Seat NFTs. It allows passengers to checkin for the flight by submitting identity documents via IPFS and receiving ERC721 Boarding Pass NFTs. A complete list of use cases are described below:

# Airline Use-Cases

1. Create Flight. Airline supplies flight-itinerary information to initiate a flight in contract storage.

2. Add Seat Inventory. Airline supplies seat numbers and corresponding seat prices for each cabin in the flight.

3. Withdraw Flight Fees. Airline can withdraw their fees from passengers' seat bookings via a pull-based payments/withdraw system.

4. Cancel Seat Bookings. Airline can cancel a passenger's seat booking, which takes back their ERC721 Seat and triggers a refund to be queued for the passenger.

5. Process Refunds. Airline can process the refunds queue to trigger payouts to passengers who are owed refunds from seat cancellations

# Passenger Use-Cases

6. Book Seat. Passengers can book available flight seats and receive ERC721 Seats for their booking.

7. Checkin. Passengers can checkin for flights which returns their ERC721 Seat to the airline. The ERC721 Seat is subsequently burned by the airline. The passenger supplies a IPFS hash for their passport-scan image in this checkin operation. When checkin succeeds the passenger receives back another ERC721 token for their Boarding Pass which is uniquely associated with their IPFS passport-scan hash.

8. Cancel Seat Bookings. Passengers can also cancel their seat booking, which returns their ERC721 Seat to the airline and triggers a refund to be queued for the passenger.

# Demo Instructions

Please note only the passenger use-cases of book-seat and checkin are available to demo via a lite-server UI layer. A web interface for allowing airlines to create flights and populate seat inventory was beyond scope given deadline-constraints. However the airline create-flight/populate seat-inventory operations are invoked in the contract's constructor to provide the passenger booking UI flow with a flight to choose and seats to book. Additionally, every airline use-case is extensively unit-tested to validate expected functionality.

Please see installation instructions which details demo pre-requisites and how to setup from scratch on VirtualBox Ubuntu. A local running IPFS instance is required, along with node version 9, npm version 6.2.0, ganache-cli, truffle, metamask. A minimum of 2018 MB memory is required on the VirtualBox Ubuntu instance. 

Assuming installation prerequisites are met, proceed as follows:

```sh
$ npm install 
$ npm run build
$ npm run test
$ ganache-cli
$ ipfs daemon
$ truffle migrate --reset --compile-all
$ npm run dev 
```

The final command ``npm run dev`` will start a locally running lite-server instance which will serve the flight booking, checkin and boarding pass UI flows to interact with the contract deployed on local ganache network. 

# Steps to demo

First log into metamask using the same seed phrase from your local running ganache-cli instance. Then switch to another of the ganche accounts in metamask instead of the default account, you can do this by selecting 'create account' in metamask which switches to another availabel ganache account. The default account is used by the contract owner to prepopulate a single flight and airline belonging to this account for demo purposes, and you cannot proceed through the flight booking and checkin flows using the same default account

  - First screen shows a single flight pre-populated from the contract's constructor. Select book flight.
  - Select a seat (confirm transaction in metamask for cost of seat)
  - View Seat booking with ERC721 Token ID
  - For demo purposes immediately proceed to checkin. Select Check In For Flight
  - Choose an image file on your local machine to submit to IPFS as your passport-scan, can be any image for demo. Choose file and then select Upload Passport to IPFS
  - Select Complete Checkin (confirm transaction in metamask for zero cost)
  - View your boarding pass, complete with 2D QRCode, ERC721 Boarding Pass ID and link to passport-scan image in IPFS.
  
Please note that currently Metamask does not yet support the ERC721 standard, so you cannot view these tokens in metamask. You can verify in truffle console that your address is the owner of the ERC721 tokens by invoking the ownerOf() function in the contract and supplying the token ID. Additionally the unit tests are verifying that the correct passenger owns the ERC721 tokens after booking and checkin.

