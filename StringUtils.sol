/**
 * @title String utility functions for Solidity contracts.
 * @author Nick Johnson <arachnid@notdot.net>
 *
 * @dev All functions are UTF-8 friendly, if input strings are valid UTF-8.
 *      Offsets and sizes are specified in bytes, not characters, and so will
 *      not respect UTF-8 character boundaries; be careful to only pass values
 *      that you know are between characters.
 */
contract StringUtils {
    function readWord(bytes a, uint idx) private returns (bytes32 word) {
        assembly {
            word := mload(add(add(a, idx), 32))
        }
    }
    
    /**
     * @dev Compares two strings, returning a negative number if a is smaller,
     *      a positive number if a is larger, and zero if the strings are equal.
     * @param a The first string to compare.
     * @param b The second string to compare.
     * @return An integer whose sign indicates the value of the comparison.
     */
    function strcmp(string a, string b) internal returns (int) {
        uint shortest = bytes(a).length;
        if (bytes(b).length < bytes(a).length)
            shortest = bytes(b).length;

        for (uint idx = 0; idx < shortest; idx += 32) {
            var diff = int(
                uint(readWord(bytes(a), idx)) - uint(readWord(bytes(b), idx)));
            if (diff != 0)
                return diff;
        }
        return int(bytes(a).length - bytes(b).length);
    }

    /**
     * @dev Finds the first occurrence of a substring in a string, returning its
     *      index, or -1 if the substring is not found.
     * @param haystack The string to search.
     * @param needle The string to look for.
     * @param idx The string index at which to start searching.
     * @return The index of the first character of the substring, or -1 if not
     *         found.
     */
    function strstr(string haystack, string needle, uint idx) internal
        returns (int)
    {
        uint needleSize = bytes(needle).length;
        bytes32 hash;
        assembly {
            hash := sha3(add(needle, 32), needleSize)
        }
        for (; idx <= bytes(haystack).length - needleSize; idx++) {
            bytes32 testHash;
            assembly {
                testHash := sha3(add(add(haystack, idx), 32), needleSize)
            }
            if (hash == testHash)
                return int(idx);
        }
        return -1;
    }
    
    /**
     * @dev Finds the last occurrence of a substring in a string, returning its
     *      index, or -1 if the substring is not found.
     * @param haystack The string to search.
     * @param needle The string to look for.
     * @param idx The string index at which to start searching.
     * @return The index of the first character of the substring, or -1 if not
     *         found.
     */
    function strrstr(string haystack, string needle, uint idx) internal
        returns (int)
    {
        uint needleSize = bytes(needle).length;
        bytes32 hash;
        assembly {
            hash := sha3(add(needle, 32), needleSize)
        }
        for (int i = int(idx); i >= 0; i--) {
            bytes32 testHash;
            assembly {
                testHash := sha3(add(add(haystack, i), 32), needleSize)
            }
            if (hash == testHash)
                return i;
        }
        return -1;
    }

    /**
     * @dev Copies part of one string into another. If the requested range
     *      extends past the end of the source or target strings, the range will
     *      be truncated. If src and dest are the same, the ranges must either
     *      not overlap, or idx must be less than start.
     * @param dest The destination string to copy into.
     * @param idx The start index in the destination string.
     * @param src The string to copy from.
     * @param start The index into the source string to start copying.
     * @param len The number of bytes to copy.
     */
    function strncpy(string dest, uint idx, string src, uint start, uint len)
        internal
    {
        if (idx + len > bytes(dest).length)
            len = bytes(dest).length - idx;
        if (start > bytes(src).length)
            return;
        if (start + len > bytes(src).length)
            len = bytes(src).length - start;

        // From here, we treat idx and start as memory offsets for dest and idx.
        // Skip over the first word, which contains the length of each string.
        idx += 32;
        start += 32;

        // Copy word-length chunks while possible
        for(; len >= 32; len -= 32) {
            assembly {
                mstore(add(dest, idx), mload(add(src, start)))
            }
            idx += 32;
            start += 32;
        }

        // Copy remaining bytes
        uint mask = 256 ** (32 - len) - 1;
        assembly {
            let destaddr := add(dest, idx)
            let srcpart := and(mload(add(src, start)), bnot(mask))
            let destpart := and(mload(destaddr), mask)
            mstore(destaddr, or(destpart, srcpart))
        }
    }
    
    /**
     * @dev Returns a substring starting at idx and continuing until the first
     *      occurrence of delim. If delim is not found, returns the remainder of
     *      the string.
     * @param str The string to return a substring of.
     * @param delim The delimiter to search for.
     * @param idx The start index.
     * @return A newly allocated string consisting of bytes between idx and the
     *         first occurrence of delim.
     */
    function strsep(string str, string delim, uint idx) internal
        returns (string ret)
    {
        int endIdx = strstr(str, delim, idx);
        if (endIdx == -1) {
            endIdx = int(bytes(str).length);
        }
        ret = new string(uint(endIdx) - idx);
        strncpy(ret, 0, str, idx, uint(endIdx) - idx);
    }

    /**
     * @dev Returns the length of a string, in characters.
     * @param str The string to return the length of.
     * @return The length of the string, in characters.
     */
    function strchrlen(string str) internal returns (uint len) {
        bytes memory strdata = bytes(str);
        for (uint i = 0; i < strdata.length; i++)
            // Don't count continuation bytes, of the form 0b10xxxxxx
            if (strdata[i] & 0xC0 != 0x80)
                len += 1;
    }

    /**
     * @dev Cheaply computes the SHA3 hash of a substring.
     * @param str The string to hash (part of).
     * @param idx The start index for the section to hash.
     * @param len The number of bytes to hash.
     * @return The SHA3 sum of the selected substring.
     */
    function sha3_substring(string str, uint idx, uint len)
        internal returns (bytes32 ret)
    {
        assembly {
            ret := sha3(add(add(str, 32), idx), len)
        }
    }
}
