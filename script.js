let minimum,
  maximum,
  minerFees,
  percentage,
  invoiceAmount,
  feeAmount,
  totalAmount,
  invoiceLN

const getCleanedContainer = (id) => {
  const container = document.querySelector(`#${id}`)
  container.removeChild(container.querySelector('p'))
  return container
}

const addFees = () => {
  const feesContainer = getCleanedContainer('feesContainer')
  feesContainer.append(feesTemplate.content.cloneNode(true))
  document.getElementById('minerFees').innerText = `${minerFees} sats`
  document.getElementById('percentage').innerText = `${percentage} %`
}

const addLimits = () => {
  const limitsContainer = getCleanedContainer('limitsContainer')
  limitsContainer.append(limitsTemplate.content.cloneNode(true))
  document.getElementById('minimum').innerText = `${minimum} sats`
  document.getElementById('maximum').innerText = `${maximum} sats`
}

const addAmount = () => {
  const amountContainer = getCleanedContainer('amountContainer')
  amountContainer.append(amountTemplate.content.cloneNode(true))
  document.getElementById('invoiceAmount').innerText = invoiceAmount
  document.getElementById('feeAmount').innerText = feeAmount
  document.getElementById('totalAmount').innerText = totalAmount
}

const addButton = () => {
  const button = window.marina ? payWithMarinaTemplate : installMarinaTemplate
  document
    .querySelector('#buttonContainer')
    .append(button.content.cloneNode(true))
}

const enableButton = () => {
  document.querySelector('#payWithMarinaButton').disabled = false
  document.querySelector('#payWithMarinaButton').onclick = payWithMarina
}

const payWithMarina = async () => {
  if (!(await window.marina.isEnabled())) await window.marina.enable()
  const nextAddress = await window.marina.getNextAddress()
  const swap = await fetch('https://api.boltz.exchange/createswap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'submarine',
      pairId: 'L-BTC/BTC',
      orderSide: 'sell',
      refundPublicKey: nextAddress.publicKey,
      invoice: invoiceLN,
    }),
  })
  const { address, expectedAmount } = await swap.json()
  const { txid, hex } = await marina.sendTransaction([
    {
      address,
      asset: '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d',
      value: expectedAmount,
    },
  ])
}

const getPairFromBoltz = async () => {
  const resp = await fetch('https://api.boltz.exchange/getpairs')
  if (!resp.ok) throw new Error(`HTTP error: ${resp.status}`)
  const json = await resp.json()
  if (!json) throw new Error('Invalid json response')
  const pair = json.pairs['L-BTC/BTC']
  if (!pair) throw new Error('Invalid pair response:', json)
  return pair
}

window.onload = () => {
  // detectif is mobile via userAgent
  if (window.navigator.userAgent.match(/Mobile|Android|BlackBerry/)) {
    document.querySelector('.show-on-mobile').style.display = 'block'
    return
  }
  document.querySelector('.show-on-desktop').style.display = 'flex'
  getPairFromBoltz().then((pair) => {
    minerFees = pair.fees.minerFees.baseAsset.normal
    percentage = pair.fees.percentageSwapIn
    minimum = pair.limits.minimal
    maximum = pair.limits.maximal
    addFees(minerFees, percentage)
    addLimits(minimum, maximum)
  })
  addButton()
}

window.addEventListener(
  'message',
  async (event) => {
    if (!minimum || !maximum) return
    if (!minerFees || !percentage) return
    if (event.origin != 'https://embed.thebitcoincompany.com') return
    const { invoice, address } = event.data
    if (!address) throw new Error('No address on TBC response')
    if (!invoice) throw new Error('No invoice on TBC response')
    const amountInAddress = address.split('amount=')?.[1]
    if (!amountInAddress) throw new Error('Invalid address format')
    invoiceAmount = Decimal.mul(amountInAddress, 100_000_000).toNumber()
    feeAmount = Math.ceil(
      Decimal.mul(invoiceAmount, percentage).div(100).add(minerFees).toNumber()
    )
    totalAmount = Decimal.add(invoiceAmount, feeAmount).toNumber()
    invoiceLN = invoice
    addAmount()
    enableButton()
  },
  false
)
