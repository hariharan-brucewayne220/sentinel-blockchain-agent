import { ActionExecuted } from "../generated/ActionLog/ActionLog"
import { Action, DailyPnL } from "../generated/schema"
import { BigInt } from "@graphprotocol/graph-ts"

export function handleActionExecuted(event: ActionExecuted): void {
  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let action = new Action(id)
  action.actionId = event.params.actionId
  action.tokenIn = event.params.tokenIn
  action.tokenOut = event.params.tokenOut
  action.amountIn = event.params.amountIn
  action.amountOut = event.params.amountOut
  action.reasoningCID = event.params.reasoningCID
  action.timestamp = event.params.timestamp
  action.save()

  let date = getDateString(event.params.timestamp)
  let daily = DailyPnL.load(date)
  if (daily == null) {
    daily = new DailyPnL(date)
    daily.date = date
    daily.tradeCount = 0
    daily.totalAmountIn = BigInt.fromI32(0)
    daily.totalAmountOut = BigInt.fromI32(0)
  }
  daily.tradeCount = daily.tradeCount + 1
  daily.totalAmountIn = daily.totalAmountIn.plus(event.params.amountIn)
  daily.totalAmountOut = daily.totalAmountOut.plus(event.params.amountOut)
  daily.save()
}

function getDateString(timestamp: BigInt): string {
  let seconds = timestamp.toI64()
  let days = seconds / 86400
  let d = days + 719468
  let era = (d >= 0 ? d : d - 146096) / 146097
  let doe = d - era * 146097
  let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
  let y = yoe + era * 400
  let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
  let mp = (5 * doy + 2) / 153
  let month = mp < 10 ? mp + 3 : mp - 9
  let day = doy - (153 * mp + 2) / 5 + 1
  if (month <= 2) y++
  let mm = month < 10 ? "0" + month.toString() : month.toString()
  let dd = day < 10 ? "0" + day.toString() : day.toString()
  return y.toString() + "-" + mm + "-" + dd
}
