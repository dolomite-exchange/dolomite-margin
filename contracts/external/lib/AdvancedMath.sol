pragma solidity ^0.5.16;


/// A library for performing various math operations
library AdvancedMath {

    // babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = (y >> 1) + 1;
            while (x < z) {
                z = x;
                x = ((y / x) + x) >> 1;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
