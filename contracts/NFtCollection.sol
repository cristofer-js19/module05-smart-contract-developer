// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.27;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Coleção NFT Limitada
 * @notice Este contrato implementa uma coleção de NFTs com limite de supply e controle de minting.
 * @dev O contrato segue o padrão ERC-721, permitindo a criação e venda de NFTs com preço fixo e limitações.
 * Este contrato é apenas para estudos, nunca utiliza-lo em produção!!!
 * @author Jeftar Mascarenhas
 */
contract NFtCollection is ERC721, ERC721Burnable, Ownable, ReentrancyGuard {
    uint256 public constant TOTAL_SUPPLY = 10;
    uint256 public constant MAX_PER_ADDRESS = 2;
    uint256 public constant NFT_PRICE = 0.05 ether;
    mapping(address => uint256) public nftsPerWallet;

    address[] public BUYER_LIST;

    uint256 public tokenIds;
    string public uri;

    error NotEnoughPrice(uint256 price);
    error ChangeMoneyDoesNotWork();
    error WithdrawFailure();
    error MaxNftsPerAddressReached();
    error MaximumTotalSupplyReached();

    constructor(
        string memory _uri,
        address[] memory _BUYER_LIST
    ) ERC721("NFT Collection", "NFTC") Ownable(msg.sender) {
        uri = _uri;
        BUYER_LIST = _BUYER_LIST;
    }

    modifier checkPrice() {
        if (msg.value < NFT_PRICE) {
            revert NotEnoughPrice(msg.value);
        }
        _;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return uri;
    }

    function _safeMint(address to) internal {
        validation(to);
        _safeMint(to, tokenIds);
        tokenIds++;
        nftsPerWallet[to]++;
    }

    function mint() external payable checkPrice {
        _safeMint(msg.sender);
    }

    function withdraw() external onlyOwner nonReentrant {
        (bool success, ) = payable(msg.sender).call{
            value: address(this).balance
        }("");

        require(success, WithdrawFailure());
    }

    function validation(address to) internal {
        require(nftsPerWallet[to] < MAX_PER_ADDRESS, MaxNftsPerAddressReached());
        require(tokenIds < TOTAL_SUPPLY, MaximumTotalSupplyReached());

        if (msg.value > NFT_PRICE) {
            uint256 changeMoney = msg.value - NFT_PRICE;
            (bool success, ) = payable(msg.sender).call{value: changeMoney}("");

            require(success, ChangeMoneyDoesNotWork());
        }
    }

    receive() external payable {}
}
