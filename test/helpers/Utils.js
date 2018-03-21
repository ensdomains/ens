function isException(error) {
    let strError = error.toString();
    return strError.includes('invalid opcode') || strError.includes('invalid JUMP') || strError.includes('revert');
}

function ensureException(error) {
    assert(isException(error), error.toString());
}

function assertJump(error) {
    assert.isAbove(error.message.search('invalid JUMP'), -1, 'Invalid JUMP error must be returned');
}

module.exports = {
    zeroAddress: '0x0000000000000000000000000000000000000000',
    isException: isException,
    ensureException: ensureException,
    assertJump: assertJump
};