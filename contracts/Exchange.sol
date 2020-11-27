// SPDX-License-Identifier: MIT

pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155Receiver.sol";

import "./Administrable.sol";

contract BestNftExchange is Administrable, ERC1155Receiver {
    using SafeERC20 for IERC20;

    IERC20 public exchangeToken;

    mapping (uint256 => uint256) private _next;
    mapping (uint256 => uint256) private _previous;
    uint256 private _tail;

    struct Order {
        IERC1155 nft;
        uint256 id;
        uint256 amount;
        address owner;
        uint256 price;
    }
    mapping (uint256 => Order) private _orders;

    uint256 private _totalOrder;
    uint256 private _nextOrderId;

    event OrderAdded(uint256 orderId, address indexed nft, uint256 id, uint256 amount, address indexed owner, uint256 price);
    event OrderRemoved(uint256 orderId);
    event PriceUpdated(uint256 orderId, uint256 price);
    event OrderConfirmed(uint256 orderId);

    constructor(address _exchangeToken) public {
        exchangeToken = IERC20(_exchangeToken);

        _nextOrderId = 1;
    }

    function totalOrder() external view returns (uint256) {
        return _totalOrder;
    }
    function getOrders() external view returns (Order[] memory result) {
        result = new Order[](_totalOrder);

        uint256 index = 0;
        uint256 orderId = _next[0];

        while (orderId > 0) {
            result[index++] = _orders[orderId];
            orderId = _next[orderId];
        }
    }
    function getOrder(uint256 id) external view returns (Order memory) {
        return _orders[id];
    }

    function buy(uint256 id) external {
        Order memory order = _orders[id];
        require(address(order.nft) != address(0), "BestNftExchange: bad id");
        require(order.owner != msg.sender, "BestNftExchange: you're the owner of this order");
        uint256 buyerBalance = exchangeToken.balanceOf(msg.sender);
        require(buyerBalance >= order.price, "BestNftExchange: insufficient balance");

        exchangeToken.safeTransferFrom(msg.sender, order.owner, order.price);
        order.nft.safeTransferFrom(address(this), msg.sender, order.id, order.amount, "");

        emit OrderConfirmed(id);

        removeOrder(id);
    }

    function revoke(uint256 id) external {
        Order memory order = _orders[id];
        require(address(order.nft) != address(0), "BestNftExchange: bad id");
        require(order.owner == msg.sender, "BestNftExchange: not order owner");

        order.nft.safeTransferFrom(address(this), msg.sender, order.id, order.amount, "");

        removeOrder(id);
    }

    function setPrice(uint256 id, uint256 price) external {
        Order storage order = _orders[id];
        require(address(order.nft) != address(0), "BestNftExchange: bad id");
        require(order.owner == msg.sender, "BestNftExchange: not order owner");

        order.price = price;

        emit PriceUpdated(id, price);
    }

    function onERC1155Received(address, address from, uint256 id, uint256 value, bytes calldata data) external override returns (bytes4) {
        uint256 price;
        if (data.length == 0)
            price = 0;
        else
            price = abi.decode(data, (uint256));

        addOrder(IERC1155(msg.sender), id, value, from, price);

        return IERC1155Receiver.onERC1155Received.selector;
    }
    function onERC1155BatchReceived(address, address from, uint256[] calldata ids, uint256[] calldata values, bytes calldata data) external override returns (bytes4) {
        uint256[] memory prices = abi.decode(data, (uint256[]));
        require(prices.length == ids.length, "BestNftExchange: prices count mismatch");

        for (uint256 i = 0; i < ids.length; i++)
            addOrder(IERC1155(msg.sender), ids[i], values[i], from, prices[i]);

        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function addOrder(IERC1155 nft, uint256 id, uint256 amount, address owner, uint256 price) private {
        uint256 orderId = _nextOrderId;

        _orders[orderId] = Order(nft, id, amount, owner, price);
        _next[_tail] = orderId;
        _previous[orderId] = _tail;
        _tail = orderId;

        _nextOrderId++;
        _totalOrder++;

        emit OrderAdded(orderId, msg.sender, id, amount, owner, price);
    }
    function removeOrder(uint256 id) private {
        delete _orders[id];

        uint256 next = _next[id];
        uint256 previous = _previous[id];

        if (_tail == id)
            _tail = previous;

        _next[previous] = next;
        _previous[next] = previous;

        delete _next[id];
        delete _previous[id];

        _totalOrder--;

        emit OrderRemoved(id);
    }

    function withdrawAll() external onlyAdmins {
        withdrawAmount(exchangeToken.balanceOf(address(this)));
    }
    function withdrawAmount(uint256 _amount) public onlyAdmins {
        exchangeToken.transfer(msg.sender, _amount);
    }
}
