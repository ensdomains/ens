var assert = require('assert');
var async = require('async');

var utils = require('./utils.js');
var web3 = utils.web3;

var accounts = null;

before(function(done) {
	web3.eth.getAccounts(function(err, acct) {
		accounts = acct
		done();
	});
});

describe('SimpleHashRegistrar', function() {
	var registrarABI = null;
	var registrarBytecode = null;
	var deedABI = null;
	var registrar = null;
	var ens = null;

	var dotEth = web3.sha3('0000000000000000000000000000000000000000000000000000000000000000' + web3.sha3('eth').slice(2), {encoding: 'hex'});
	var nameDotEth = web3.sha3(dotEth + web3.sha3('name').slice(2), {encoding: 'hex'});

	before(function() {
		this.timeout(30000);
		var code = utils.compileContract(['interface.sol', 'HashRegistrarSimplified.sol']);
		registrarABI = JSON.parse(code.contracts['Registrar'].interface);
		registrarBytecode = code.contracts['Registrar'].bytecode;
		deedABI = JSON.parse(code.contracts['Deed'].interface);
	});

	beforeEach(function(done) {
		this.timeout(5000);
		async.series([
			function(done) { ens = utils.deployENS(accounts[0], done); },
			function(done) {
				registrar = web3.eth.contract(registrarABI).new(
				    ens.address,
				    dotEth,
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
			function(done) { ens.setSubnodeOwner(0, web3.sha3('eth'), registrar.address, {from: accounts[0]}, done);}
		], done);
	});

	it('starts auctions', function(done) {
		async.series([
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			function(done) {
				registrar.entries(web3.sha3('name'), function(err, result) {
					assert.equal(err, null, err);
					assert.equal(result[0], 1); // status == Auction
					assert.equal(result[1], 0); // deed == 0x00
					var dateDiff = Math.abs(result[2].toNumber() - new Date().getTime() / 1000 - 14 * 24 * 60 * 60);
					assert.ok(dateDiff < 5, dateDiff); // registrationDate
					assert.equal(result[3], 0); // value = 0
					assert.equal(result[4], 0); // highestBid = 0
					done();
				});
			}
		], done);
	});

	it('records bids', function(done) {
		var bid = null;
		async.series([
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			function(done) {
				registrar.shaBid(web3.sha3('name'), accounts[0], 1e18, 0, function(err, result) {
					bid = result;
					assert.equal(err, null, err);
					registrar.newBid(bid, {from: accounts[0], value: 2e18}, function(err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			function(done) {
				registrar.sealedBids(bid, function(err, deedAddress) {
					assert.equal(err, null, err);
					web3.eth.getBalance(deedAddress, function(err, balance) {
						assert.equal(err, null, err);
						assert.equal(balance.toNumber(), 2e18);
						done();
					})
				});
			}
		], done);
	});

	it('concludes auctions', function(done) {
		this.timeout(5000);
		var bidData = [
			// A regular bid
			{description: 'A regular bid', account: accounts[0], value: 1.1e18, deposit: 2.0e18, salt: 1, expectedFee: 0.001 },
			// A better bid
			{description: 'Winning bid', account: accounts[1], value: 2.0e18, deposit: 2.0e18, salt: 2, expectedFee: 0.75 },
			// Lower, but affects second place
			{description: 'Losing bid that affects price', account: accounts[2], value: 1.5e18, deposit: 2.0e18, salt: 3, expectedFee: 0.001 },
			// No effect
			{description: 'Losing bid that doesn\'t affect price', account: accounts[3], value: 1.2e18, deposit: 2.0e18, salt: 4, expectedFee: 0.001 },
			// Deposit smaller than value
			{description: 'Bid with deposit less than claimed value', account: accounts[4], value: 1.3e18, deposit: 1.0e17, salt: 5, expectedFee: 0.001 },
			// Invalid - doesn't reveal
			{description: 'Bid that wasn\'t revealed in time', account: accounts[5], value: 1.4e18, deposit: 2.0e18, salt: 6, expectedFee: 0.99 }
		];
		async.series([
			// Save initial balances 
			function(done) {
				async.each(bidData, function(bid, done) {
					web3.eth.getBalance(bid.account, function(err, balance){
						bid.startingBalance = balance.toFixed();
						done();
					});
				}, done);
			},			// Start an auction for 'name'
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Place each of the bids
			function(done) {
				async.each(bidData, function(bid, done) {
					registrar.shaBid(web3.sha3('name'), bid.account, bid.value, bid.salt, function(err, result) {
						bid.sealedBid = result;
						assert.equal(err, null, err);
						registrar.newBid(bid.sealedBid, {from: bid.account, value: bid.deposit}, function(err, txid) {
							assert.equal(err, null, err);
							done();
						});
					});
				}, done);
			},
			// Advance 27 days to the reveal period
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [13 * 24 * 60 * 60 + 1]}, done);
			},
			// Reveal all the bids
			function(done) {
				async.each(bidData, function(bid, done) {
					if (bid.salt !== 6) {
						registrar.unsealBid(web3.sha3('name'), bid.account, bid.value, bid.salt, {from: bid.account}, function(err, txid) {
							assert.equal(err, null, err);
							done();
						});
					} else {
						done();
					}
				}, done);
			},
			// Advance another day to the end of the auction
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [1 * 24 * 60 * 60]}, done);
			},
			// Reveal last bid
			function(done) {
				bid = bidData[5];
				registrar.unsealBid(web3.sha3('name'), bid.account, bid.value, bid.salt, {from: bid.account}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Finalize the auction
			function(done) {
				registrar.finalizeAuction(web3.sha3('name'), {from: accounts[0]}, function(err, txid) {
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
					async.series([
						// Check the owner is correct
						function(done) {
							var deed = web3.eth.contract(deedABI).at(result[1]);
							deed.owner(function(err, addr) {
								assert.equal(err, null, err);
								assert.equal(addr, accounts[1]);
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
						}
					], done);
				});
			},
			// Check balances
			function(done) {
				async.each(bidData, function(bid, done) {
					web3.eth.getBalance(bid.account, function(err, balance){
						// Sleep sort is Best sort
						// setTimeout(function() {
						var spentFee = Math.floor(10000*(bid.startingBalance - balance.toFixed()) / Math.min(bid.value, bid.deposit))/10000;
						console.log('\t Bidder #' + bid.salt, bid.description + '. Spent:', 100*spentFee + '%; Expected:', 100*bid.expectedFee + '%;');
						assert.equal(spentFee, bid.expectedFee);
						done();
						// }, Number(bid.salt)*100);
						
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

	it('calling startAuction on a finished auction has no effect', function(done) {
		var auctionStatus = null;
		async.series([
			// Start an auction for 'name'
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Place a bid on it
			function(done) {
				registrar.shaBid(web3.sha3('name'), accounts[0], 1e18, 1, function(err, result) {
					assert.equal(err, null, err);
					registrar.newBid(result, {from: accounts[0], value: 1e18}, function(Err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Advance 13 days to the reveal period
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [13 * 24 * 60 * 60 + 1]}, done);
			},
			// Reveal the bid
			function(done) {
				registrar.unsealBid(web3.sha3('name'), accounts[0], 1e18, 1, {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					registrar.entries(web3.sha3('name'), function(err, result) {
						assert.equal(err, null, err);
						auctionStatus = result;
						done();
					});
				});
			},
			// Advance another day to the end of the auction
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [1 * 24 * 60 * 60]}, done);
			},
			// Have someone else call startAuction
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Check that the deed is still set correctly
			function(done) {
				registrar.entries(web3.sha3('name'), function(err, result) {
					assert.equal(err, null, err);
					assert.deepEqual(auctionStatus, result);
					done();
				});
			}
		], done);
	});

	it('takes the max of declared and provided value', function(done) {
		async.series([
			// Start an auction for 'name'
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Place some bids
			function(done) {
				registrar.shaBid(web3.sha3('name'), accounts[0], 2e18, 1, function(err, result) {
					assert.equal(err, null, err);
					registrar.newBid(result, {from: accounts[0], value: 1e18}, function(Err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			function(done) {
				registrar.shaBid(web3.sha3('name'), accounts[1], 4e18, 1, function(err, result) {
					assert.equal(err, null, err);
					registrar.newBid(result, {from: accounts[1], value: 3e18}, function(Err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Advance 13 days to the reveal period
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [13 * 24 * 60 * 60 + 1]}, done);
			},
			// Reveal the bids and check they're processed correctly.
			function(done) {
				registrar.unsealBid(web3.sha3('name'), accounts[0], 2e18, 1, {from: accounts[0]}, function(err, txid) {
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
				registrar.unsealBid(web3.sha3('name'), accounts[0], 4e18, 1, {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					registrar.entries(web3.sha3('name'), function(err, result) {
						assert.equal(err, null, err);
						assert.equal(result[3], 1e18);
						assert.equal(result[4], 2e18);
						auctionStatus = result;
						done();
					});
				});
			}
		], done);
	});

	it('Invalidate short name', function(done) {
		let bidData = [ {account: accounts[0], value: 1.5e18, deposit: 2e18, salt: 1, description: 'bidded before invalidation' },
						{account: accounts[1], value: 1.0e18, deposit: 2e18, salt: 2, description: 'bidded after invalidation' }]
		let invalidator = {account: accounts[2]};
		async.series([
			// Save initial balances 
			function(done) {
				async.each(bidData, function(bid, done) {
					web3.eth.getBalance(bid.account, function(err, balance){
						bid.startingBalance = balance.toFixed();
						done();
					});
				}, done);
			},
			// Save initial invalidator balances 
			function(done) {
				web3.eth.getBalance(invalidator.account, function(err, balance){
					invalidator.startingBalance = balance.toFixed();
					done();
				});
			},			
			function(done) {
				// Test multiple auctions
				registrar.startAuctions([web3.sha3('name'), web3.sha3('longname'), web3.sha3('thirdname')], {from: accounts[0]}, done);
			},
			function(done) {
				registrar.entries(web3.sha3('name'), function(err, result) {
					// Test if foo is an auction
					assert.equal(result[0], 1); // status == Auction
					done();
				});
			},			
			function(done) {
				registrar.entries(web3.sha3('longname'), function(err, result) {
					// Tests if foobars is an auction
					assert.equal(result[0], 1); // status == Auction
					done();
				});
			},
			// Place each of the bids
			function(done) {
				async.each(bidData, function(bid, done) {
					registrar.shaBid(web3.sha3('name'), bid.account, bid.value, bid.salt, function(err, result) {
						bid.sealedBid = result;
						assert.equal(err, null, err);
						registrar.newBid(bid.sealedBid, {from: bid.account, value: bid.deposit}, function(err, txid) {
							assert.equal(err, null, err);
							done();
						});
					});
				}, done);
			},
			// Advance 27 days to the reveal period
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [13 * 24 * 60 * 60 + 1]}, done);
			},
			// Reveal the first bid
			function(done) {
				bid = bidData[0];
				registrar.unsealBid(web3.sha3('name'), bid.account, bid.value, bid.salt, {from: bid.account}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});		
			},
			// Invalidate Name
			function(done) {
				registrar.invalidateName('name', {from: invalidator.account}, function(err, txid) {
					assert.equal(err, null);
					done();
				});		
			},
			function(done) {
				registrar.entries(web3.sha3('name'), function(err, result) {
					// Test if 'foo' is now 'forbidden'
					assert.equal(result[0], 3); // status == Forbidden	
					done();
				});
			},
			// Reveal the second bid
			function(done) {
				bid = bidData[1];
				registrar.unsealBid(web3.sha3('name'), bid.account, bid.value, bid.salt, {from: bid.account}, function(err, txid) {
						assert.equal(err, null);
						done();
				});		
			},
			// Check balances
			function(done) {
				async.each(bidData, function(bid, done) {
					web3.eth.getBalance(bid.account, function(err, balance){
						// Sleep sort is Best sort
						var spentFee = Math.floor(web3.fromWei(bid.startingBalance - balance.toFixed(), 'finney'));
						
						console.log('\t Bidder #'+ bid.salt, bid.description, 'spent:', spentFee, 'finney;');

						assert.equal(spentFee, (bid.salt == 1 ? 750 : 0));
						// console.log(spentFee == (bid.salt == 1 ? 750 : 0));

						done();
						
					});
				}, done);
			},
			// Get current invalidator balances 
			function(done) {
				web3.eth.getBalance(invalidator.account, function(err, balance){
					let fee = Math.floor(web3.fromWei(balance.toFixed() - invalidator.startingBalance, 'finney'));
					console.log('\t Invalidator got: ', fee, 'finney');
					assert.equal(fee, 749);
					done();
				});
			},
			function(done) {
				// Makes sure it can't be registered again
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, function(err, res){
					assert.notEqual(err, null);
					done();
				});
			}
		], done);
	});

	it('supports transferring deeds to another registrar', function(done) {
		var bidData = [
			{account: accounts[0], value: 1e18, deposit: 2e18, salt: 1},
		];
		var deedAddress = null;
		async.series([
			// Start an auction for 'name'
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Place each of the bids
			function(done) {
				registrar.shaBid(web3.sha3('name'), accounts[0], 1e18, 1, function(err, result) {
					var sealedBid = result;
					assert.equal(err, null, err);
					registrar.newBid(sealedBid, {from: accounts[0], value: 2e18}, function(err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Advance 27 days to the reveal period
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [13 * 24 * 60 * 60 + 1]}, done);
			},
			// Reveal the bid
			function(done) {
				registrar.unsealBid(web3.sha3('name'), accounts[0], 1e18, 1, {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Advance another day to the end of the auction
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [1 * 24 * 60 * 60]}, done);
			},
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
			// Update ENS with a new registrar
			function(done) {
				ens.setSubnodeOwner(0, web3.sha3('eth'), accounts[0], {from: accounts[0]}, done);
			},
			// Transfer the deed
			function(done) {
				registrar.transferRegistrars(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Check the deed was transferred as expected
			function(done) {
				web3.eth.contract(deedABI).at(deedAddress).owner(function(err, owner) {
					assert.equal(err, null, err);
					assert.equal(accounts[0], owner);
					done();
				});
			}
		], done);		
	});
});
