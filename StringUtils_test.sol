import 'dapple/test.sol';
import 'StringUtils.sol';

contract StringUtilsTest is Test, StringUtils {
    function abs(int x) returns (int) {
        if(x < 0)
            return -x;
        return x;
    }

    function sign(int x) returns (int) {
        return x/abs(x);
    }

    function assertEq(string a, string b) {
        assertEq(strcmp(a, b), 0);
    }

    function testStrcmp() logs_gas {
        assertEq(sign(strcmp("foobie", "foobie")), 0);
        assertEq(sign(strcmp("foobie", "foobif")), -1);
        assertEq(sign(strcmp("foobie", "foobid")), 1);
        assertEq(sign(strcmp("foobie", "foobies")), -1);
        assertEq(sign(strcmp("foobie", "foobi")), 1);
        assertEq(sign(strcmp("foobie", "doobie")), 1);
        assertEq(sign(strcmp("01234567890123456789012345678901", "012345678901234567890123456789012")), -1);
    }

    function testStrstr() logs_gas {
        assertEq(strstr("abracadabra", "bra", 0), 1);
        assertEq(strstr("abracadabra", "bra", 2), 8);
        assertEq(strstr("abracadabra", "rab", 0), -1);
        assertEq(strstr("ABC ABCDAB ABCDABCDABDE", "ABCDABD", 0), 15);
    }

    function testStrncpy() logs_gas {
        string memory target = "0123456789";
        
        // Basic nonoverlapping copy
        strncpy(target, 0, target, 5, 5);
        assertEq(target, "5678956789");

        // Truncate input range
        strncpy(target, 0, target, 8, 5);
        assertEq(target, "8978956789");

        // Truncate output range
        strncpy(target, 8, target, 1, 5);
        assertEq(target, "8978956797");

        // Overlapping copy
        strncpy(target, 0, target, 2, 8);
        assertEq(target, "7895679797");

        // Copy a longer string
        string memory longer = "0123456789012345678901234567890123456789012345";
        strncpy(longer, 0, longer, 1, 45);
        assertEq(longer, "1234567890123456789012345678901234567890123455");
    }

    function testStrsep() logs_gas {
        assertEq(strsep("www.google.com", ".", 0), "www");
        assertEq(strsep("www.google.com", ".", 4), "google");
        assertEq(strsep("www.google.com", ".", 11), "com");
        assertEq(strsep("www.google.com", ".", 15), "");
        assertEq(strsep("foo->bar->baz", "->", 0), "foo");      
        assertEq(strsep("foo->bar->baz", "->", 5), "bar");      
    }

    function testStrchrlen() logs_gas {
        assertEq(strchrlen(""), 0);
        assertEq(strchrlen("foobar"), 6);
        assertEq(strchrlen("I ♥ ethereum"), 12);
    }
}
