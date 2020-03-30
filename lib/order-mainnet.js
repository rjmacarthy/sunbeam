'use strict'

const threshold = 900719.92547

class Order {
  constructor (order, conf) {
    this.raw = order
    this.validate()
    this.parse()
    this.seskey1 = conf.seskey1
    this.seskey2 = conf.seskey2
  }

  validate () {
    const { raw } = this
    const priceFits = Number(raw.price || 0) <= threshold
    if (!priceFits) {
      throw new Error('price should be less than ' + threshold)
    }

    if (Math.abs(Number(raw.amount)) > threshold) {
      throw new Error('amount should be between -' + threshold + '-' + threshold)
    }
  }

  parse () {
    const { raw } = this
    const res = {
      clientId: +raw.clientId || +raw.cid || Date.now(),
      type: raw.type,
      // TODO: flags are processed differently for efx and bfx
      flags: +raw.flags || 0,
      price: +raw.price || 0,
      amount: +raw.amount
    }

    if (raw.type === 'EXCHANGE_MARKET') {
      if (!res.flags) res.flags = 4
      if (!(res.flags & 4)) res.flags = res.flags + 4
    }

    if (raw.type === 'EXCHANGE_IOC') {
      if (!res.flags) res.flags = 2
      if (!(res.flags & 2)) res.flags = res.flags + 2
    }

    // safeguard ioc and market overload
    if (!!(res.flags & 4) && !!(res.flags & 2)) {
      throw new Error('flag/ordertype overload: IOC & MARKET')
    }

    if (raw.postOnly) {
      if (!res.flags) res.flags = 1
      if (!(res.flags & 1)) res.flags = res.flags + 1
    }

    const [base, quote, sym] = this._getSymbolData(raw.symbol)
    res.base = base
    res.quote = quote
    res.symbol = sym

    this.parsed = res
    return res
  }

  getMsgObj () {
    const p = this.parsed
    return {
      cid: p.clientId,
      type: p.type,
      symbol: p.symbol,
      price: p.price + '',
      amount: p.amount + ''
    }
  }

  serialize () {
    const p = this.parsed

    const payload = {
      order: {
        nonce: Date.now(),
        seskey1: this.seskey1,
        seskey2: this.seskey2,
        price: p.price * Math.pow(10, 10),
        amount: p.amount * Math.pow(10, 10),
        base: p.base,
        quote: p.quote,
        flags: p.flags
      }
    }

    return payload
  }

  _getSymbolData (symbol) {
    // EFX-style
    if (symbol.includes('.')) {
      const [base, quote] = symbol.split('.')
      return [base, quote, 't' + base + (quote === 'USDT' ? 'UST' : quote)]
    }

    // BFX-style
    const normalized = symbol.slice(1)
    const base = normalized.substring(0, 3)
    const quote = normalized.substring(3)
    return [base, quote, symbol]
  }
}

module.exports = Order