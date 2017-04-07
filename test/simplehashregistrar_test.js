
var assert = require('assert');
var async = require('async');
var Promise = require('bluebird');

var utils = require('./utils.js');
var web3 = utils.web3;

var accounts = null;

before(function(done) {
	web3.eth.getAccounts(function(err, acct) {
		accounts = acct
		done();
	});
});

function advanceTime(delay, done) {
	web3.currentProvider.sendAsync({
		jsonrpc: "2.0",
		"method": "evm_increaseTime",
		params: [delay]}, done)
}
var advanceTimeAsync = Promise.promisify(advanceTime);

// days in secs
function days(numberOfDays) {
	return numberOfDays * 24 * 60 * 60;
}

describe('SimpleHashRegistrar', function() {
	var registrarABI = null;
	var registrarBytecode = null;
	var deedABI = null;
	var registrar = null;
	var ens = null;
	var throwingBidder = null;

	var dotEth = web3.sha3('0000000000000000000000000000000000000000000000000000000000000000' + web3.sha3('eth').slice(2), {encoding: 'hex'});
	var nameDotEth = web3.sha3(dotEth + web3.sha3('name').slice(2), {encoding: 'hex'});

	before(function() {
		this.timeout(30000);
		var code = utils.compileContract(['AbstractENS.sol', 'HashRegistrarSimplified.sol']);
		registrarABI = JSON.parse(code.contracts['HashRegistrarSimplified.sol:Registrar'].interface);
		registrarBytecode = code.contracts['HashRegistrarSimplified.sol:Registrar'].bytecode;
		deedABI = JSON.parse(code.contracts['HashRegistrarSimplified.sol:Deed'].interface);
	});

	beforeEach(function(done) {
		this.timeout(5000);
		async.series([
			function(done) { ens = utils.deployENS(accounts[0], done); },
			function(done) {
				registrar = web3.eth.contract(registrarABI).new(
				    ens.address,
				    dotEth,
				    0,
				    {
				    	from: accounts[0],
				     	data: registrarBytecode,
				     	gas: 4700000
				   	}, function(err, contract) {
				   	    assert.equal(err, null, err);
				   	    if(contract.address != undefined) {
				   	    	registrar = Promise.promisifyAll(registrar);
				   	    	done();
					   	}
				   });
			},
			function(done) {
				throwingBidder = web3.eth.contract([{"inputs":[],"payable":false,"type":"constructor"}]).new(
					{
						from: accounts[0],
						data: "0x60606040523415600b57fe5b5b5b5b603380601b6000396000f30060606040525bfe00a165627a7a72305820439539138917e1fca55719c0d3bb351280d3d8db3698b096c8ce05eb72d74c1e0029",
						gas: 1000000
					}, function(err, contract) {
						assert.equal(err, null, err);
						if(contract.address != undefined) {
							throwingBidder = Promise.promisifyAll(throwingBidder);
							done();
						}
					});
			},
			function(done) { ens.setSubnodeOwner(0, web3.sha3('eth'), registrar.address, {from: accounts[0]}, done);}
		], done);
	});

	it('starts auctions', function(done) {
		async.series([
			function(done) { 
				advanceTime(days(100), done); 
			},		
			function(done) { 
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Advance to the 2nd day
			function(done) { advanceTime(days(2), done); },
			// Starting the same auction again should have no effect
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			function(done) {
				registrar.entries(web3.sha3('name'), function(err, result) {
					assert.equal(err, null, err);
					assert.equal(result[0], 1); // status == Auction
					assert.equal(result[1], 0); // deed == 0x00
					// Expected to end 5 days from start
					var expectedEnd = new Date().getTime() / 1000 + days(105);
					assert.ok(Math.abs(result[2].toNumber() - expectedEnd) < 5); // registrationDate
					assert.equal(result[3], 0); // value = 0
					assert.equal(result[4], 0); // highestBid = 0
					done();
				});
			},
			// Advance 30 days
			function(done) { advanceTime(days(30), done); },
			// Advancing days only have an effect after a transaction
			function(done) {
				registrar.startAuction(web3.sha3('anothername'), {from: accounts[0]}, done);
			},
			// Check later auctions end 5 days after they start
			function(done) {
				registrar.entries(web3.sha3('anothername'), function(err, result) {
					assert.equal(err, null, err);
					// Expected to end 137 days from start (100 + 2 + 30 + 5)
					var expectedEnd = new Date().getTime() / 1000 + days(137);
					assert.ok(Math.abs(result[2].toNumber() - expectedEnd) < 5); // registrationDate
					done();
				});
			}			
		], done);
	});

	it('launch starts slow with scheduled availability', function(done) {
		var launchLength = days(7 * 13);
		var registryStarted = 0;
		async.series([
			function(done) { 
				registrar.registryStarted(function(err, result){ 
					registryStarted = Number(result); 
					done();
				});
			},
			function(done) { 
				registrar.getAllowedTime('0x00', function(err, result){ 
					// 0x00 should be available immediately
					assert.equal(err, null, err);
					assert.equal(Number(result) , registryStarted);
					done();
				});
			},
			function(done) { 
				registrar.getAllowedTime('0x80', function(err, result){ 
					// 0x80 hash should be available at half the time
					assert.equal(Number(result)-registryStarted , launchLength/2); 					
					done();
				});
			},
			function(done) { 
				registrar.getAllowedTime('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', function(err, result){ 
					assert.equal(err, null, err);
					// Should be available at last second
					assert.equal(Number(result)-registryStarted , launchLength-1); 					
					done();
				});
			},
			function(done) { 
				registrar.getAllowedTime(web3.sha3('ethereum'), function(err, result){ 
					assert.equal(err, null, err);
					// 'ethereum' should be available in 30 days
					assert.equal(Math.round((Number(result)-registryStarted)/days(1)), 30);
					done();
				});
			},
			function(done) { 
				advanceTime(days(1), done); 
			},
			function(done) {
				registrar.startAuction(web3.sha3('freedomhacker'), {from: accounts[0]}, function(err, result) {
					// Should be able to open this
					assert.equal(err, null);
					done();
				});
			},	
			function(done) {
				registrar.startAuction(web3.sha3('ethereum'), {from: accounts[0]}, function(err, result) {
					// Should NOT be able to open this
					assert.ok(err, err)
					done();
				});
			},	
			function(done) {
				registrar.startAuction(web3.sha3('unicorn'), {from: accounts[0]}, function(err, result) {
					// Should NOT be able to open this
					assert.ok(err, err)
					done();
				});
			},	
			function(done) {
				registrar.entries(web3.sha3('freedomhacker'), function(err, result) {
					assert.equal(err, null, err);
					// Should be status 1 (Auction)
					assert.equal(result[0], 1);
					done();
				});
			},	
			function(done) {
				registrar.entries(web3.sha3('ethereum'), function(err, result) {
					assert.equal(err, null, err);
					// Should be status 5 (unavailable)
					assert.equal(result[0], 5); 
					done();
				});
			},	
			function(done) {
				registrar.entries(web3.sha3('unicorn'), function(err, result) {
					assert.equal(err, null, err);
					// Should be status 5 (unavailable)
					assert.equal(result[0], 5);
					done();
				});
			},
			function(done) { 
				advanceTime(days(30), done); 
			},	
			function(done) {
				registrar.startAuction(web3.sha3('ethereum'), {from: accounts[0]}, function(err, result) {
					// Should be able to open this now
					assert.equal(err, null)
					done();
				});
			},
			function(done) {
				registrar.entries(web3.sha3('freedomhacker'), function(err, result) {
					assert.equal(err, null, err);
					// Should be status 0 (Open, because no bids)
					assert.equal(result[0], 0);
					done();
				});
			},	
			function(done) {
				registrar.entries(web3.sha3('ethereum'), function(err, result) {
					assert.equal(err, null, err);
					// Should be status 1 (Auction)
					assert.equal(result[0], 1); 
					done();
				});
			},	
			function(done) {
				registrar.entries(web3.sha3('unicorn'), function(err, result) {
					assert.equal(err, null, err);
					// Should still be status 5 (unavailable)
					assert.equal(result[0], 5);
					done();
				});
			},	
			function(done) { 
				advanceTime(days(60), done); 
			},	
			function(done) {
				registrar.startAuction(web3.sha3('unicorn'), {from: accounts[0]}, function(err, result) {
					// Should be able to open this now
					assert.equal(err, null)
					done();
				});
			},	
			function(done) {
				registrar.entries(web3.sha3('unicorn'), function(err, result) {
					assert.equal(err, null, err);
					// Should be status 1 (Auction)
					assert.equal(result[0], 1); 
					done();
				});
			}
		], done);
	});	

	it('records bids', function(done) {
		var bid = null;
		async.series([
			function(done) { 
				advanceTime(days(90), done); 
			},
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Submit a bid
			function(done) {
				registrar.shaBid(web3.sha3('name'), 1e18, 0, function(err, result) {
					bid = result;
					assert.equal(err, null, err);
					registrar.newBid(bid, {from: accounts[0], value: 2e18}, function(err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Check a duplicate bid would throw
			function(done) {
				registrar.newBid.call(bid, {from: accounts[0], value: 2e18}, function(err, result) {
					assert.ok(err, err);
					done();
				})
			},
			// Check it was recorded correctly
			function(done) {
				registrar.sealedBids(accounts[0], bid, function(err, deedAddress) {
					assert.equal(err, null, err);
					web3.eth.getBalance(deedAddress, function(err, balance) {
						assert.equal(err, null, err);
						assert.equal(balance.toNumber(), 2e18);
						done();
					})
				});
			},
			// Submit a less-than-minimum bid and check it throws
			function(done)  {
				registrar.newBid.call(0, {from: accounts[0], value: 1e15 - 1}, function(err, result) {
					assert.ok(err, err);
					done();
				});
			},
		], done);
	});

	it('concludes auctions', function(done) {
		this.timeout(5000);
		var bidData = [
			// A regular bid
			{description: 'A regular bid', account: accounts[0], value: 1.1e18, deposit: 2.0e18, salt: 1, expectedFee: 0.005 },
			// A better bid
			{description: 'Winning bid', account: accounts[1], value: 2.0e18, deposit: 2.0e18, salt: 2, expectedFee: 0.75 },
			// Lower, but affects second place
			{description: 'Losing bid that affects price', account: accounts[2], value: 1.5e18, deposit: 2.0e18, salt: 3, expectedFee: 0.005 },
			// No effect
			{description: 'Losing bid that doesn\'t affect price', account: accounts[3], value: 1.2e18, deposit: 2.0e18, salt: 4, expectedFee: 0.005 },
			// Deposit smaller than value
			{description: 'Bid with deposit less than claimed value', account: accounts[4], value: 5.0e18, deposit: 1.0e17, salt: 5, expectedFee: 0.005 },
			// Invalid - doesn't reveal
			{description: 'Bid that wasn\'t revealed in time', account: accounts[5], value: 1.4e18, deposit: 2.0e18, salt: 6, expectedFee: 0.995 }
		];
		async.series([
			// moves past the soft launch dates
			function(done) { 
				advanceTime(days(90), done); 
			},
			// Save initial balances
			function(done) {
				async.each(bidData, function(bid, done) {
					web3.eth.getBalance(bid.account, function(err, balance){
						bid.startingBalance = balance.toFixed();
						done();
					});
				}, done);
			},
			// Start an auction for 'name'
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},	
			function(done) {
				registrar.entries(web3.sha3('name'), function(err, result) {
					assert.equal(err, null, err);
					// Should be status 1 (Auction)
					assert.equal(result[0], 1);
					done();
				});
			},
			// Place each of the bids
			function(done) {
				async.each(bidData, function(bid, done) {
					registrar.shaBid(web3.sha3('name'), bid.value, bid.salt, function(err, result) {
						bid.sealedBid = result;
						assert.equal(err, null, err);
						registrar.newBid(bid.sealedBid, {from: bid.account, value: bid.deposit}, function(err, txid) {
							assert.equal(err, null, err);
							done();
						});
					});
				}, done);
			},
			// Try to reveal a bid early
			function(done) {
				registrar.unsealBid(web3.sha3('name'), bidData[0].value, bidData[0].salt, {from: bidData[0].account}, function(err, txid) {
					assert.ok(err, err);
					done();
				});
			},
			// Advance 3 days to the reveal period
			function(done) { advanceTime(days(3) + 1, done); },	
			// Start an auction for 'anothername' to force time update
			function(done) {
				registrar.startAuction(web3.sha3('anothername'), {from: accounts[0]}, done);
			},
			// checks status
			function(done) {
				registrar.entries(web3.sha3('name'), function(err, result) {
					assert.equal(err, null, err);
					// Should be status 4 (Reveal)
					assert.equal(result[0], 4);
					done();
				});
			},
			// Reveal all the bids
			function(done) {
				async.each(bidData, function(bid, done) {
					if (bid.salt !== 6) {

						registrar.unsealBid(web3.sha3('name'), bid.value, bid.salt, {from: bid.account}, function(err, txid) {
							assert.equal(err, null, err);
							done();
						});
					} else {
						done();
					}
				}, done);
			},
			// Advance another two days to the end of the auction
			function(done) { advanceTime(days(2), done); },
			// Reveal last bid
			function(done) {
				bid = bidData[5];
				registrar.unsealBid(web3.sha3('name'), bid.value, bid.salt, {from: bid.account}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Finalize the auction
			function(done) {
				registrar.finalizeAuction(web3.sha3('name'), {from: accounts[1]}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Check the name has the correct owner, value, and highestBid
			function(done) {
				registrar.entries(web3.sha3('name'), function(err, result) {
					assert.equal(err, null, err);
					assert.equal(result[0], 2); // status == Owned
					assert.equal(result[3], 1.5e18); // value = 1.5 ether
					assert.equal(result[4], 2e18); // highestBid = 2 ether
					var deed = web3.eth.contract(deedABI).at(result[1]);
					async.series([
						// Check the owner is correct
						function(done) {
							deed.owner(function(err, addr) {
								assert.equal(err, null, err);
								assert.equal(addr, accounts[1]);
								done();
							});
						},
						// Check the registrar is correct
						function(done) {
							deed.registrar(function(err, addr) {
								assert.equal(err, null, err);
								assert.equal(addr, registrar.address);
								done();
							});
						},
						// Check the balance is correct
						function(done) {
							web3.eth.getBalance(result[1], function(err, balance) {
								assert.equal(err, null, err);
								assert.equal(balance.toNumber(), bidData[2].value);
								done();
							});
						},
						// Check the value is correct
						function(done) {
							deed.value(function(err, value) {
								assert.equal(err, null, err);
								assert.equal(value, bidData[2].value);
								done();
							});
						}
					], done);
				});
			},
			// Check balances
			function(done) {
				async.each(bidData, function(bid, done) {
					web3.eth.getBalance(bid.account, function(err, balance){
						var spentFee = Math.floor(10000*(bid.startingBalance - balance.toFixed()) / Math.min(bid.value, bid.deposit))/10000;
						console.log('\t Bidder #' + bid.salt, bid.description + '. Spent:', 100*spentFee + '%; Expected:', 100*bid.expectedFee + '%;');
						assert.equal(spentFee, bid.expectedFee);
						done();
					});
				}, done);
			},
			// Check the owner is set in ENS
			function(done) {
				ens.owner(nameDotEth, function(err, owner) {
					assert.equal(err, null, err);
					assert.equal(owner, accounts[1]);
					done();
				});
			}
		], done);
	});

	it('cancels bids', function(done) {
		this.timeout(5000);
		var bidData = [
			// A regular bid
			{description: 'A regular bid 1', account: accounts[0], value: 1.5e18, deposit: 2.0e18, salt: 1, expectedFee: 0.005 },
			{description: 'A regular bid 2', account: accounts[1], value: 1.1e18, deposit: 2.0e18, salt: 1, expectedFee: 0.005 },
			{description: 'A regular bid 3', account: accounts[2], value: 1.1e18, deposit: 2.0e18, salt: 1, expectedFee: 0.005 },
		];

		async.series([
			// moves past the soft launch dates
			function(done) { 
				advanceTime(days(90), done); 
			},
			// Start an auction for 'cancelname'
			function(done) {
				registrar.startAuction(web3.sha3('cancelname'), {from: accounts[0]}, done);
			},
			// Place each of the bids
			function(done) {
				async.each(bidData, function(bid, done) {
					registrar.shaBid(web3.sha3('cancelname'), bid.value, bid.salt, function(err, result) {
						bid.sealedBid = result;
						assert.equal(err, null, err);
						registrar.newBid(bid.sealedBid, {from: bid.account, value: bid.deposit}, function(err, txid) {
							assert.equal(err, null, err);
							done();
						});
					});
				}, done);
			},
			// Attempt to cancel the first bid and fail
			function(done) {
				let bid = bidData[0];
				registrar.shaBid(web3.sha3('cancelname'), bid.value, bid.salt, function(err, result) {
					bid.sealedBid = result;
					registrar.cancelBid(bid.account, bid.sealedBid, {from: bid.account}, function(err, txid) {
						assert.notEqual(err, null, err);
						registrar.sealedBids(bid.account, bid.sealedBid, function(err, result) {
							assert.equal(err, null, err);
							assert.notEqual(result, 0);
							console.log('\t Bid #1 not cancelled');
							done();
						});
					});
				});
			},
			// Advance 3 days to the reveal period
			function(done) { advanceTime(days(3) + 1, done); },

			// Attempt to cancel the second bid and fail
			function(done) {
				let bid = bidData[1];
				registrar.shaBid(web3.sha3('cancelname'), bid.value, bid.salt, function(err, result) {
					bid.sealedBid = result;
					registrar.cancelBid(bid.account, bid.sealedBid, {from: bid.account}, function(err, txid) {
						assert.notEqual(err, null, err);
						registrar.sealedBids(bid.account, bid.sealedBid, function(err, result) {
							assert.equal(err, null, err);
							assert.notEqual(result, 0);
							console.log('\t Bid #2 not cancelled pre-reveal');
							done();
						});
					});
				});
			},
			// Checks the bid exists
			function(done) {
				let bid = bidData[1];
				registrar.sealedBids(bid.account, bid.sealedBid, function(err, result) {
					assert.notEqual(result, '0x0000000000000000000000000000000000000000');
					done();
				});
			},
			// Reveal the second bid
			function(done) {
				let bid = bidData[1];				
				registrar.unsealBid(web3.sha3('cancelname'), bid.value, bid.salt, {from: bid.account}, function(err, txid) {
					assert.equal(err, null, err);
					console.log('\t Bid #2 revealed');
					done();
				});
			},
			// Checks the bid doesn't exist anymore
			function(done) {
				let bid = bidData[1];				
				registrar.sealedBids(bid.account, bid.sealedBid, function(err, result) {
					assert.equal(result, '0x0000000000000000000000000000000000000000');
					done();
				});
			},
			// Attempt to cancel the second bid and fail
			function(done) {
				let bid = bidData[1];
				registrar.shaBid(web3.sha3('cancelname'), bid.value, bid.salt, function(err, result) {
					bid.sealedBid = result;

					registrar.sealedBids(bid.account, bid.sealedBid, function(err, result) {
						// Checks the bid exists
						assert.equal(result, '0x0000000000000000000000000000000000000000');

						registrar.cancelBid(bid.account, bid.sealedBid, {from: bid.account}, function(err, txid) {
							assert.notEqual(err, null, err);
							registrar.sealedBids(bid.account, bid.sealedBid, function(err, result) {
								assert.equal(err, null, err);
								assert.equal(result, 0);
								console.log('\t Bid #2 not cancelled post-reveal. Sealedbid removed');
								done();
							});
						});
					});
				});
			},
			// Advance another two days to the end of the auction
			function(done) { advanceTime(days(2), done); },
			// Finalize the auction and get the deed address
			function(done) {
				registrar.finalizeAuction(web3.sha3('cancelname'), {from: accounts[1]}, function(err, txid) {
					assert.equal(err, null, err);
					registrar.entries(web3.sha3('cancelname'), function(err, result) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Attempt to cancel the third bid and fail
			function(done) {
				let bid = bidData[2];
				registrar.shaBid(web3.sha3('cancelname'), bid.value, bid.salt, function(err, result) {
					bid.sealedBid = result;

					registrar.sealedBids(bid.account, bid.sealedBid, function(err, result) {
						// Bid should exist
						assert.notEqual(result, '0x0000000000000000000000000000000000000000');

						registrar.cancelBid(bid.account, bid.sealedBid, {from: bid.account}, function(err, txid) {
							// should give an error
							assert.ok(err, err);
							
							registrar.sealedBids(bid.account, bid.sealedBid, function(err, result) {
								// Bid should still exist
								assert.notEqual(result, '0x0000000000000000000000000000000000000000');
								console.log('\t Bid #3 not cancelled immediately');
								done();
							});
						});
					});

					
				});
			},
			// Advance 13 weeks
			function(done) { advanceTime(13 * days(7), done); },

			// Attempt to cancel the third bid again
			function(done) {
				let bid = bidData[2];
				registrar.shaBid(web3.sha3('cancelname'), bid.value, bid.salt, function(err, result) {
					bid.sealedBid = result;

					registrar.sealedBids(bid.account, bid.sealedBid, function(err, result) {
						// Bid should exist
						assert.notEqual(result, 0);
						
						registrar.cancelBid(bid.account, bid.sealedBid, {from: bid.account}, function(err, txid) {
							// should NOT give an error
							assert.equal(err, null);
							
							registrar.sealedBids(bid.account, bid.sealedBid, function(err, result) {
								// Bid should not exist anymore
								assert.equal(result, 0);
								done();
							});
						});
					});					
				});
			},
			// Attempt to cancel again and fail
			function(done) {
				let bid = bidData[2];
				registrar.shaBid(web3.sha3('cancelname'), bid.value, bid.salt, function(err, result) {
					bid.sealedBid = result;
					registrar.cancelBid(bid.account, bid.sealedBid, {from: bid.account}, function(err, txid) {
						assert.notEqual(err, null, err);
						console.log('\t Bid #3 could not cancel a second time');
						done();
					});
				});
			}
		], done);
	});

	it('releases deed after one year', function(done) {
		this.timeout(5000);
		var bidData = [{description: 'Winning bid', account: accounts[0], value: 10.0e18, deposit: 10.0e18, salt: 1, expectedFee: 0.005 },
					{description: 'Second bid', account: accounts[1], value: 5.0e18, deposit: 10.0e18, salt: 1, expectedFee: 0.005 }];
		var startdate = null;
		async.series([
			// moves past the soft launch dates
			function(done) { 
				advanceTime(days(90), done); 
			},
			// Start an auction for 'releasename'
			function(done) {
				registrar.startAuction(web3.sha3('releasename'), {from: bidData[0].account}, done);
			},
			// Place the bid


			function(done) {
				async.each(bidData, function(bid, done) {
					registrar.shaBid(web3.sha3('releasename'), bid.value, bid.salt, function(err, result) {
						bid.sealedBid = result;

						assert.equal(err, null, err);
						registrar.newBid(bid.sealedBid, {from: bid.account, value: bid.deposit}, function(err, txid) {
							assert.equal(err, null, err);
							done();
						});
					});
				}, done);
			},
			// Advance 3 days to the reveal period
			function(done) { advanceTime(days(3) + 1, done); },
			// Reveal the bids
			function(done) {
				async.each(bidData, function(bid, done) {
					registrar.unsealBid(web3.sha3('releasename'), bid.value, bid.salt, {from: bid.account}, function(err, txid) {
						assert.equal(err, null, err);
						done();
					});
				}, done);

			},
			// Advance another two days to the end of the auction
			function(done) { advanceTime(days(2), done); },
			// Finalize the auction
			function(done) {
				registrar.finalizeAuction(web3.sha3('releasename'), {from: bidData[0].account}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Save balance
			function(done) {
				web3.eth.getBalance(bidData[0].account, function(err, balance){
					bidData[0].startingBalance = balance.toFixed();
					done();
				});
			},
			// Attempt to release the deed early
			function(done) {
				registrar.releaseDeed(web3.sha3('releasename'), {from: bid.account}, function(err, txid) {
					assert.notEqual(err, null, err);
					console.log("\t Could not release early");
					done();
				});
			},
			// Advance one year
			function(done) { advanceTime(days(365), done); },

			// Try and fail to release the deed as the wrong user
			function(done) {
				registrar.releaseDeed(web3.sha3('releasename'), {from: accounts[1]}, function(err, txid) {
					assert.notEqual(err, null, err);
					console.log("\t Could not release as someone else");
					done();
				});
			},

			// Release the deed
			function(done) {
				// web3.eth.getBalance(bid.account, function(err, initialBalance){
					registrar.releaseDeed(web3.sha3('releasename'), {from: bidData[0].account}, function(
						err, txid) {
						assert.equal(err, null, err);
						web3.eth.getBalance(bidData[0].account, function(err, balance){
							console.log('\t Deed released:', Math.round(web3.fromWei(balance.toFixed() - bidData[0].startingBalance, 'ether')), "ether returned to owner after releasing name");

							assert.ok(balance.toFixed() > bidData[0].startingBalance);
							done();
						});
					});
				// });
			},
			// Attempt to release the deed twice
			function(done) {
				registrar.releaseDeed(web3.sha3('releasename'), {from: bidData[0].account}, function(err, txid) {
					assert.notEqual(err, null, err);
					console.log("\t Could not release deed twice");
					done();
				});
			},
			// Check the name has the correct state and owner
			function(done) {
				registrar.entries(web3.sha3('releasename'), function(err, result) {
					assert.equal(err, null, err);
					assert.equal(result[0], 0); // status == Open
					console.log("\t Name is Open");
					done();
				});
			},
			// Check the owner is set to 0 in ENS
			function(done) {
				ens.owner(web3.sha3(dotEth + web3.sha3('releasename').slice(2), {encoding: 'hex'}), function(err, owner) {
					assert.equal(err, null, err);
					assert.equal(owner, 0);
					done();
				});
			},
			function(done) {
				web3.eth.getBlock('latest', function(err, block) {
					startdate = block.timestamp;
					done();
				});
			},
			// Check we can start an auction on the name
			function(done) {
				registrar.startAuction(web3.sha3('releasename'), {from: bidData[0].account}, done);
			},
			// Check that the end time is set correctly
			function(done) {
				registrar.entries(web3.sha3('releasename'), function(err, result) {
					assert.equal(err, null, err);
					var expectedEnd = startdate + days(5);
					assert.ok(Math.abs(result[2].toNumber() - expectedEnd) < 5, Math.abs(result[2].toNumber() - expectedEnd)); // registrationDate
					done();
				});
			},
		], done);
	});

	it("allows releasing a deed immediately when no longer the registrar", function(done) {
		var sealedBid = null;
		advanceTimeAsync(days(91))
			.then((done) => registrar.startAuctionAsync(web3.sha3('name'), {from: accounts[0]}))
			.then((done) => registrar.shaBidAsync(web3.sha3('name'), 1e18, 1))
			.then((result) => {
				sealedBid = result;
				return registrar.newBidAsync(result, {from: accounts[0], value: 1e18});
			})
			.then((done) => advanceTimeAsync(days(3) + 1))
			.then((done) => registrar.unsealBidAsync(web3.sha3('name'), 1e18, 1, {from: accounts[0]}))
			.then((done) => advanceTimeAsync(days(2) + 1))
			.then((done) => registrar.finalizeAuctionAsync(web3.sha3('name'), {from: accounts[0]}))
			.then((done) => ens.setSubnodeOwnerAsync(0, web3.sha3('eth'), accounts[0], {from: accounts[0]}))
			.then((done) => registrar.releaseDeedAsync(web3.sha3('name'), {from: accounts[0]}))
			.asCallback(done);
	});

	it('rejects bids less than the minimum', function(done) {
		advanceTimeAsync(days(91))
			.then((done) => registrar.startAuctionAsync(web3.sha3('name'), {from: accounts[0]}))			.then((done) => registrar.shaBidAsync(web3.sha3('name'), 1e15 - 1, 1))
			.then((result) => registrar.newBidAsync(result, {from: accounts[0], value: 1e18}))
			.then((done) => advanceTimeAsync(days(3) + 1))
			.then((done) => registrar.unsealBidAsync(web3.sha3('name'), 1e15 - 1, 1, {from: accounts[0]}))
			.then((done) => registrar.entriesAsync(web3.sha3('name')))
			.then((result) => assert.equal(result[4], 0)) // highestBid == 0
			.asCallback(done);
	});

	it("doesn't allow finalizing an auction early", function(done) {
		var sealedBid = null;

		advanceTimeAsync(days(91))
			.then((done) => registrar.startAuctionAsync(web3.sha3('name'), {from: accounts[0]}))			.then((done) => registrar.finalizeAuctionAsync(web3.sha3('name'), {from: accounts[0]}))
			.then((done) => assert.fail("Expected exception"), (err) => assert.ok(err, err))

			.then((done) => registrar.shaBidAsync(web3.sha3('name'), 1e18, 1))
			.then((result) => {
				sealedBid = result;
				return registrar.newBidAsync(result, {from: accounts[0], value: 1e18});
			})
			.then((done) => advanceTimeAsync(days(3) + 1))
			.then((done) => registrar.unsealBidAsync(web3.sha3('name'), 1e18, 1, {from: accounts[0]}))
			.then((done) => registrar.finalizeAuctionAsync(web3.sha3('name'), {from: accounts[0]}))
			.then((done) => assert.fail("Expected exception"), (err) => assert.ok(err, err))

			.then((done) => advanceTimeAsync(days(2) + 1))
			.then((done) => registrar.finalizeAuctionAsync(web3.sha3('name'), {from: accounts[1]}))
			.then((done) => assert.fail("Expected exception"), (err) => assert.ok(err, err))

			.then((done) => registrar.finalizeAuctionAsync(web3.sha3('name'), {from: accounts[0]}))
			.then((done) => registrar.finalizeAuctionAsync(web3.sha3('name'), {from: accounts[0]}))
			.asCallback(done);
	});

	it("allows finalizing an auction even when no longer the registrar", function(done) {
		var sealedBid = null;
		advanceTimeAsync(days(91))
			.then((done) => registrar.startAuctionAsync(web3.sha3('name'), {from: accounts[0]}))			.then((done) => registrar.shaBidAsync(web3.sha3('name'), 1e18, 1))
			.then((result) => {
				sealedBid = result;
				return registrar.newBidAsync(result, {from: accounts[0], value: 1e18});
			})
			.then((done) => advanceTimeAsync(days(3) + 1))
			.then((done) => registrar.unsealBidAsync(web3.sha3('name'), 1e18, 1, {from: accounts[0]}))
			.then((done) => advanceTimeAsync(days(2) + 1))
			.then((done) => ens.setSubnodeOwnerAsync(0, web3.sha3('eth'), accounts[0], {from: accounts[0]}))
			.then((done) => registrar.finalizeAuctionAsync(web3.sha3('name'), {from: accounts[0]}))
			.asCallback(done);
	});

	it("doesn't allow revealing a bid on a name not up for auction", function(done) {
		var sealedBid = null;

		advanceTimeAsync(days(91))
			.then((done) => registrar.shaBidAsync(web3.sha3('name'), 1e18, 1))
			.then((result) => {
				sealedBid = result;
				return registrar.newBidAsync(result, {from: accounts[0], value: 1e18});
			})
			.then((done) => registrar.unsealBidAsync(web3.sha3('name'), 1e18, 1, {from: accounts[0]}))
			.then((done) => assert.fail("Expected exception"), (err) => assert.ok(err, err))
			// Check reveal works after starting the auction
			.then((done) => advanceTimeAsync(days(1)))
			.then((done) => registrar.startAuctionAsync(web3.sha3('name'), {from: accounts[0]}))
			.then((done) => advanceTimeAsync(days(3) + 1))
			.then((done) => registrar.unsealBidAsync(web3.sha3('name'), 1e18, 1, {from: accounts[0]}))
			.asCallback(done);
	});

	it("doesn't invalidate long names", function(done) {
		var sealedBid = null;
		advanceTimeAsync(days(91))
			.then((done) => registrar.startAuctionAsync(web3.sha3('longname'), {from: accounts[0]}))	
			.then((done) => registrar.shaBidAsync(web3.sha3('longname'), 1e18, 1))
			.then((result) => {
				sealedBid = result;
				return registrar.newBidAsync(result, {from: accounts[0], value: 1e18});
			})
			.then((done) => advanceTimeAsync(days(3) + 1))
			.then((done) => registrar.unsealBidAsync(web3.sha3('longname'), 1e18, 1, {from: accounts[0]}))
			.then((done) => advanceTimeAsync(days(2) + 1))
			.then((done) => registrar.finalizeAuctionAsync(web3.sha3('longname'), {from: accounts[0]}))
			.then((done) => registrar.invalidateNameAsync('longname', {from: accounts[0]}))
			.then((done) => assert.fail("Expected exception"), (err) => assert.ok(err, err))
			.asCallback(done);
	});

	it("allows invalidation even when no longer the registrar", function(done) {
		var sealedBid = null;
		advanceTimeAsync(days(91))
			.then((done) => registrar.startAuctionAsync(web3.sha3('name'), {from: accounts[0]}))
			.then((done) => registrar.shaBidAsync(web3.sha3('name'), 1e18, 1))
			.then((result) => {
				sealedBid = result;
				return registrar.newBidAsync(result, {from: accounts[0], value: 1e18});
			})
			.then((done) => advanceTimeAsync(days(3) + 1))
			.then((done) => registrar.unsealBidAsync(web3.sha3('name'), 1e18, 1, {from: accounts[0]}))
			.then((done) => advanceTimeAsync(days(2) + 1))
			.then((done) => registrar.finalizeAuctionAsync(web3.sha3('name'), {from: accounts[0]}))
			.then((done) => ens.setSubnodeOwnerAsync(0, web3.sha3('eth'), accounts[0], {from: accounts[0]}))
			.then((done) => registrar.invalidateNameAsync('name', {from: accounts[0]}))
			.asCallback(done);
	});

	it('calling startAuction on a finished auction has no effect', function(done) {
		var auctionStatus = null;
		async.series([
			// moves past the soft launch dates
			function(done) { 
				advanceTime(days(90), done); 
			},
			// Start an auction for 'name'
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Place a bid on it
			function(done) {
				registrar.shaBid(web3.sha3('name'), 1e18, 1, function(err, result) {
					assert.equal(err, null, err);
					registrar.newBid(result, {from: accounts[0], value: 1e18}, function(Err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Advance 26 days to the reveal period
			function(done) { advanceTime(days(3) + 1, done); },
			// Reveal the bid
			function(done) {
				registrar.unsealBid(web3.sha3('name'), 1e18, 1, {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					registrar.entries(web3.sha3('name'), function(err, result) {
						assert.equal(err, null, err);
						auctionStatus = result;
						done();
					});
				});
			},
			// Advance another two days to the end of the auction
			function(done) { advanceTime(days(2), done); },
			// Have someone else call startAuction
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, function(err, result) {
					assert.ok(err, err);
					done();
				});
			},
			// Check that the deed is still set correctly
			function(done) {
				registrar.entries(web3.sha3('name'), function(err, result) {
					assert.equal(err, null, err);
					assert.deepEqual(auctionStatus.slice(1), result.slice(1));
					done();
				});
			}
		], done);
	});

	it('takes the max of declared and provided value', function(done) {
		async.series([
			// moves past the soft launch dates
			function(done) { 
				advanceTime(days(90), done); 
			},
			// Start an auction for 'name'
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Place some bids
			function(done) {
				registrar.shaBid(web3.sha3('name'), 2e18, 1, function(err, result) {
					assert.equal(err, null, err);
					registrar.newBid(result, {from: accounts[0], value: 1e18}, function(Err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			function(done) {
				registrar.shaBid(web3.sha3('name'), 4e18, 1, function(err, result) {
					assert.equal(err, null, err);
					registrar.newBid(result, {from: accounts[1], value: 3e18}, function(Err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Advance 26 days to the reveal period
			function(done) { advanceTime(days(3) + 1, done); },
			// Reveal the bids and check they're processed correctly.
			function(done) {
				registrar.unsealBid(web3.sha3('name'), 2e18, 1, {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					registrar.entries(web3.sha3('name'), function(err, result) {
						assert.equal(err, null, err);
						assert.equal(result[3], 0);
						assert.equal(result[4], 1e18);
						auctionStatus = result;
						done();
					});
				});
			},
			function(done) {
				registrar.unsealBid(web3.sha3('name'), 4e18, 1, {from: accounts[1]}, function(err, txid) {
					assert.equal(err, null, err);
					registrar.entries(web3.sha3('name'), function(err, result) {
						assert.equal(err, null, err);
						assert.equal(result[3], 1e18);
						assert.equal(result[4], 3e18);
						auctionStatus = result;
						done();
					});
				});
			}
		], done);
	});

	it('invalidates short names', function(done) {
		let bid = {account: accounts[0], value: 1.5e18, deposit: 2e18, salt: 1, description: 'bidded before invalidation' };
		let invalidator = {account: accounts[2]};
		eth = Promise.promisifyAll(web3.eth);
		eth.getBalanceAsync(bid.account)
			// Store balances
			.then((balance) => { bid.startingBalance = balance.toFixed(); })
			.then((result) => web3.eth.getBalanceAsync(invalidator.account))
			.then((balance) => { invalidator.startingBalance = balance.toFixed(); })
			// Advance time past soft launch
			.then((result) => advanceTimeAsync(days(90)))
			// Start some auctions
			.then((result) => registrar.startAuctionsAsync([web3.sha3('name'), web3.sha3('longname'), web3.sha3('thirdname')], {from: accounts[0]}))
			// Bid on 'name'
			.then((result) => registrar.shaBidAsync(web3.sha3('name'), bid.value, bid.salt))
			.then((sealedBid) => {
				bid.sealedBid = sealedBid;
				return registrar.newBidAsync(sealedBid, {from: bid.account, value: bid.deposit});
			})
			// Advance time to the reveal period
			.then((result) => advanceTimeAsync(days(3) + 1))
			// Reveal the bid
			.then((result) => registrar.unsealBidAsync(web3.sha3('name'), bid.value, bid.salt, {from: bid.account}))
			// Advance to the end of the auction
			.then((result) => advanceTimeAsync(daysInSec(2)))
			// Invalidate the name
			.then((result) => registrar.invalidateNameAsync('name', {from: invalidator.account}))
			// Check it was invalidated
			.then((result) => registrar.entriesAsync(web3.sha3('name')))
			.then((entry) => { assert.equal(entry[0], 3); })
			// Check account balances
			.then((result) => eth.getBalanceAsync(bid.account))
			.then((balance) => {
				var spentFee = Math.floor(web3.fromWei(bid.startingBalance - balance.toFixed(), 'finney'));
				console.log('\t Bidder #'+ bid.salt, bid.description, 'spent:', spentFee, 'finney;');
				assert.equal(spentFee, 5);
			})
			.then((result) => eth.getBalanceAsync(invalidator.account))
			.then((balance) => {
					let fee = Math.floor(web3.fromWei(balance.toFixed() - invalidator.startingBalance, 'finney'));
					console.log('\t Invalidator got: ', fee, 'finney');
					assert.equal(fee, 4);
			})
			// check the owner field was cleared.
			.then((result) => ens.ownerAsync(nameDotEth))
			.then((owner) => {
				assert.equal(owner, 0);
			})
			// Check we can't restart the auction process.
			.then((result) => registrar.startAuctionAsync(web3.sha3('name'), {from: accounts[0]}))
			.then((done) => assert.fail("Expected exception"), (err) => assert.ok(err, err))
			.asCallback(done);
	});

	it('supports transferring deeds to another registrar', function(done) {
		var bidData = [
			{account: accounts[0], value: 1e18, deposit: 2e18, salt: 1},
		];
		var deedAddress = null;
		var newRegistrar = null;
		async.series([
			// Advance past soft launch
			function(done) { advanceTime(days(90) + 1, done); },
			// Start an auction for 'name'
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Place each of the bids
			function(done) {
				registrar.shaBid(web3.sha3('name'), 1e18, 1, function(err, result) {
					var sealedBid = result;
					assert.equal(err, null, err);
					registrar.newBid(sealedBid, {from: accounts[0], value: 2e18}, function(err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Advance 26 days to the reveal period
			function(done) { advanceTime(days(3) + 1, done); },
			// Reveal the bid
			function(done) {
				registrar.unsealBid(web3.sha3('name'), 1e18, 1, {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Advance another two days to the end of the auction
			function(done) { advanceTime(days(2), done); },
			// Finalize the auction and get the deed address
			function(done) {
				registrar.finalizeAuction(web3.sha3('name'), {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					registrar.entries(web3.sha3('name'), function(err, result) {
						assert.equal(err, null, err);
						deedAddress = result[1];
						done();
					});
				});
			},
			// Transferring the deed should fail
			function(done) {
				registrar.transferRegistrars(web3.sha3('name'), {from: accounts[0]}, function(err, result) {
					assert.ok(err, err);
					done();
				});
			},
			// Deploy a new registrar
			function(done) {
				newRegistrar = web3.eth.contract(registrarABI).new(
				    ens.address,
				    dotEth,
				    0,
				    {
				    	from: accounts[0],
				     	data: registrarBytecode,
				     	gas: 4700000
				   	}, function(err, contract) {
				   	    assert.equal(err, null, err);
				   	    if(contract.address != undefined) {
				   	    	done();
					   	}
				   });
			},
			// Update ENS with a new registrar
			function(done) {
				ens.setSubnodeOwner(0, web3.sha3('eth'), newRegistrar.address, {from: accounts[0]}, done);
			},
			// Transfer the deed
			function(done) {
				registrar.transferRegistrars(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Check the deed was transferred as expected
			function(done) {
				web3.eth.contract(deedABI).at(deedAddress).registrar(function(err, owner) {
					assert.equal(err, null, err);
					assert.equal(newRegistrar.address, owner);
					done();
				});
			},
			// Check the record is unset on the old registrar
			function(done) {
				registrar.entries(web3.sha3('name'), function(err, entry) {
					assert.equal(err, null, err);
					assert.equal(entry[0], 0);
					assert.equal(entry[1], 0);
					assert.equal(entry[2], 0);
					assert.equal(entry[3], 0);
					assert.equal(entry[4], 0);
					done();
				});
			}
		], done);
	});

	it('supports transferring domains to another account', function(done) {
		var bidData = [
			{account: accounts[0], value: 1e18, deposit: 2e18, salt: 1},
		];
		var deedAddress = null;
		async.series([
			// Advance 
			function(done) { advanceTime(days(90), done); },
			
			// Start an auction for 'name'
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Place each of the bids
			function(done) {
				registrar.shaBid(web3.sha3('name'), 1e18, 1, function(err, result) {
					var sealedBid = result;
					assert.equal(err, null, err);
					registrar.newBid(sealedBid, {from: accounts[0], value: 2e18}, function(err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Advance 3 days to the reveal period
			function(done) { advanceTime(days(3) + 1, done); },
			// Reveal the bid
			function(done) {
				registrar.unsealBid(web3.sha3('name'), 1e18, 1, {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},

			// Make sure we can't transfer it yet
			function(done) {
				registrar.transfer(web3.sha3('name'), accounts[1], {from: accounts[0]}, function(err, txid) {
					assert.ok(err, err);
					done();
				});
			},

			// Advance another two days to the end of the auction
			function(done) { advanceTime(days(2), done); },
			// Finalize the auction and get the deed address
			function(done) {
				registrar.finalizeAuction(web3.sha3('name'), {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					registrar.entries(web3.sha3('name'), function(err, result) {
						assert.equal(err, null, err);
						deedAddress = result[1];
						done();
					});
				});
			},

			// Try and transfer it when we don't own it
			function(done) {
				registrar.transfer(web3.sha3('name'), accounts[1], {from: accounts[1]}, function(err, txid) {
					assert.ok(err, err);
					done();
				});
			},

			// Transfer ownership to another account
			function(done) {
				registrar.transfer(web3.sha3('name'), accounts[1], {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Check the new owner was set on the deed
			function(done) {
				web3.eth.contract(deedABI).at(deedAddress).owner(function(err, owner) {
					assert.equal(err, null, err);
					assert.equal(accounts[1], owner);
					done();
				});
			},
			// Check the new owner was set in ENS
			function(done) {
				ens.owner(nameDotEth, function(err, owner) {
					assert.equal(err, null, err);
					assert.equal(accounts[1], owner);
					done();
				});
			}
		], done);
	});

	it('prohibits late funding of bids', function(done) {
		let bid = {account: accounts[0], value: 1.3e18, deposit: 1.0e18, salt: 1, description: 'underfunded bid' };
		let bidWinner = {account: accounts[1], value: 1.2e18, deposit: 1.6e18, salt: 1, description: 'normally funded bid' };
		let deedAddress = null;

		async.series([
			// Advance past soft launch
			function(done) { advanceTime(days(90), done); },
			// Save initial balances
			function(done) {
				web3.eth.getBalance(bid.account, function(err, balance){
					bid.startingBalance = balance.toFixed();
					done();
				});
			},
			function(done) {
				// Start auction
				registrar.startAuction(web3.sha3('longname'), {from: accounts[0]}, done);
			},
			// Place the underfunded bid
			function(done) {
				registrar.shaBid(web3.sha3('longname'), bid.value, bid.salt, function(err, result) {
					bid.sealedBid = result;
					assert.equal(err, null, err);
					registrar.newBid(bid.sealedBid, {from: bid.account, value: bid.deposit}, function(err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Place the normal bid
			function(done) {
				registrar.shaBid(web3.sha3('longname'), bidWinner.value, bidWinner.salt, function(err, result) {
					bidWinner.sealedBid = result;
					assert.equal(err, null, err);
					registrar.newBid(bidWinner.sealedBid, {from: bidWinner.account, value: bidWinner.deposit}, function(err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Advance 3 days to the reveal period
			function(done) { advanceTime(days(3) + 1, done); },
			// Reveal the normal bid
			function(done) {
				registrar.unsealBid(web3.sha3('longname'), bidWinner.value, bidWinner.salt, {from: bidWinner.account}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});

			},
			// Sneakily top up the bid
			function(done) {
				registrar.sealedBids(bid.account, bid.sealedBid, function(err, deedAddress) {
					assert.equal(err, null, err);
					// Deploy a self-destructing contract to top up the account
					web3.eth.contract([{"inputs":[{"name":"target","type":"address"}],"payable":true,"type":"constructor"}]).new(
					    deedAddress,
					    {
					    	from: accounts[0],
					     	data: "0x6060604052604051602080607b833981016040528080519060200190919050505b8073ffffffffffffffffffffffffffffffffffffffff16ff5b505b60338060486000396000f30060606040525bfe00a165627a7a72305820d4d9412759c88c41f1dd38f8ae34c9c2fa9d5c9fa90eadb1b343a98155e74bb50029",
					     	gas: 4700000,
					     	value: 2e18,
					   	},
							function(err, contract) {
								assert.equal(err, null, err);
								if(contract.address != undefined) {
									// Check the balance was topped up.
									web3.eth.getBalance(deedAddress, function(err, balance) {
										assert.equal(err, null, err);
										assert.equal(balance, 3000000000000000000);
										done();
									});
								}
					   	});
				});
			},
			// Reveal the underfunded bid
			function(done) {
				registrar.unsealBid(web3.sha3('longname'), bid.value, bid.salt, {from: bid.account}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});

			},
			// Check balance
			function(done) {
				web3.eth.getBalance(bid.account, function(err, balance){
					var spentFee = Math.floor(web3.fromWei(bid.startingBalance - balance.toFixed(), 'finney'));
					console.log('\t Bidder #'+ bid.salt, bid.description, 'spent:', spentFee, 'finney;');
					// Bid is considered equal to 1 ether and loses, costing 0.5%
					assert.equal(spentFee, 5);
					done();
				});
			},
			// Advance another two days to the end of the auction
			function(done) { advanceTime(days(2), done); },
			// Finalize the auction and get the deed address
			function(done) {
				registrar.finalizeAuction(web3.sha3('longname'), {from: bidWinner.account}, function(err, txid) {
					assert.equal(err, null, err);
					registrar.entries(web3.sha3('longname'), function(err, result) {
						assert.equal(err, null, err);
						deedAddress = result[1];
						done();
					});
				});
			},
			// Check the new owner was set on the deed
			function(done) {
				web3.eth.contract(deedABI).at(deedAddress).owner(function(err, owner) {
					console.log('\t',bid.account == owner? "underfunded bid wins" : "underfunded bid loses");
					assert.equal(err, null, err);
					assert.equal(accounts[1], owner);
					done();
				});
			}
		], done);
	});

	it('prohibits bids during the reveal period', function(done) {
		let bid = {account: accounts[0], value: 1.5e18, deposit: 1e17, salt: 1, description: 'underfunded bid' };
		async.series([
			// Advance past soft launch
			function(done) { advanceTime(days(90), done); },
			// Save initial balances
			function(done) {
				web3.eth.getBalance(bid.account, function(err, balance){
					bid.startingBalance = balance.toFixed();
					done();
				});
			},
			function(done) {
				// Start auction
				registrar.startAuction(web3.sha3('longname'), {from: accounts[0]}, done);
			},
			// Advance 3 days to the reveal period
			function(done) { advanceTime(days(3) + 1, done); },
			// Place the bid
			function(done) {
				registrar.shaBid(web3.sha3('longname'), bid.value, bid.salt, function(err, result) {
					bid.sealedBid = result;
					assert.equal(err, null, err);
					registrar.newBid(bid.sealedBid, {from: bid.account, value: bid.deposit}, function(err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Reveal the bid
			function(done) {
				registrar.unsealBid(web3.sha3('longname'), bid.value, bid.salt, {from: bid.account}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			function(done) {
				registrar.entries(web3.sha3('longname'), function(err, result) {
					assert.equal(err, null, err);
					assert.equal(result[1], "0x0000000000000000000000000000000000000000");
					done();
				});
			},
		], done);
	});

	it('allows returning deeds from previous registrars', function(done) {
		var bid = {account: accounts[0], value: 1e18, deposit: 2e18, salt: 1};
		var deedAddress = null;
		var newRegistrar = null;
		async.series([
			// Advance past soft launch
			function(done) { advanceTime(days(90), done); },
			// Save initial balances
			function(done) {
				web3.eth.getBalance(bid.account, function(err, balance){
					bid.startingBalance = balance.toFixed();
					done();
				});
			},
			// Start an auction for 'name'
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Place each of the bids
			function(done) {
				registrar.shaBid(web3.sha3('name'), bid.value, 1, function(err, result) {
					var sealedBid = result;
					assert.equal(err, null, err);
					registrar.newBid(sealedBid, {from: accounts[0], value: bid.deposit}, function(err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Deploy a new registrar
			function(done) {
				newRegistrar = web3.eth.contract(registrarABI).new(
				    ens.address,
				    dotEth,
				    0,
				    {
				    	from: accounts[0],
				     	data: registrarBytecode,
				     	gas: 4700000
				   	}, function(err, contract) {
				   	    assert.equal(err, null, err);
				   	    if(contract.address != undefined) {
				   	    	done();
					   	}
				   });
			},
			function(done) { ens.setSubnodeOwner(0, web3.sha3('eth'), newRegistrar.address, {from: accounts[0]}, done);},
			// Advance 3 days to the reveal period
			function(done) { advanceTime(days(3) + 1, done); },
			// Reveal the bid
			function(done) {
				registrar.unsealBid(web3.sha3('name'), bid.value, 1, {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Advance another two days to the end of the auction
			function(done) { advanceTime(days(2), done); },
			// Get the deed address
			function(done) {
				registrar.entries(web3.sha3('name'), function(err, result) {
					assert.equal(err, null, err);
					deedAddress = result[1];
					done();
				});
			},
			// Transfer the deed
			function(done) {
				registrar.transferRegistrars(web3.sha3('name'), {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Return the deed
			function(done) {
				newRegistrar.returnDeed(deedAddress, {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Check balance
			function(done) {
				web3.eth.getBalance(bid.account, function(err, balance){
					var spentFee = Math.floor(web3.fromWei(bid.startingBalance - balance.toFixed(), 'finney'));
					console.log('\t Bidder #'+ bid.salt, bid.description, 'spent:', spentFee, 'finney;');
					assert.equal(spentFee, 0);
					done();
				});
			}
		], done);
	})

	it("prohibits starting auctions when it's not the registrar", function(done) {
		var bid = {account: accounts[0], value: 1e18, deposit: 2e18, salt: 1};
		var deedAddress = null;
		var newRegistrar = null;
		async.series([
			// Advance past soft launch
			function(done) { advanceTime(days(90), done); },
			// Start an auction for 'name'
			function(done) { ens.setSubnodeOwner(0, web3.sha3('eth'), accounts[0], {from: accounts[0]}, done);},
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, function(err, txid) {
					assert.ok(err, err);
					done();
				});
			},
		], done);
	});
});
