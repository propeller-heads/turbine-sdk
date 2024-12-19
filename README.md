# Turbine SDK

Turbine is a protocol that lets users swap tokens without revealing their intention to do so.

The Turbine protocol is described in more detail [in a section below](#the-turbine-protocol).

This SDK helps you with submitting orders to Turbine.

## Installation

Make sure you have [Node.js](https://nodejs.org/en/download/package-manager) and [Yarn](https://yarnpkg.com/getting-started/install) installed.

Install dependencies with:

```bash
yarn
```

## The Turbine protocol

### Contract addresses

| Contract     | Address |
| ------------ | ------- |
| OrderSettler | TODO    |

### Architecture

TODO

### How it works

A simplified workflow goes like this:

-   users and market makers submit their trade orders to Turbine API running in a TEE ([see more on orders](#orders))
-   Turbine determines the market mid-price using multiple oracles and updates limit prices of orders that rely on mid-price delta
-   Turbine matches the orders, finding coincidences of wants, and determines uniform market clearing prices ([see more on matching algorithm](#matching-algorithm))
-   Turbine sends a transaction to the OrderSettler contract on L1 chain
-   the OrderSettler contract executes the settlement transaction and transfers tokens between users and market makers.

### Orders

TODO

### Matching algorithm

TODO

## Submitting orders

> You can submit orders using our frontend: https://swap.propellerheads.xyz/turbine

It is possible to submit orders with the SDK.

TODO: How to create and submit order
