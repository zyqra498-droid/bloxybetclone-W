--[[
  Roblox-side helper (private server / controlled environment).
  Reports trade outcomes to your Node API. Configure SECRET to match TRADE_HMAC_SECRET derivation pattern.
  This does NOT automate Roblox client trades; it only validates and notifies when you wire HttpService + trade events.
]]

local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local CONFIG = {
	ApiBase = "https://yourdomain.com",
	WebhookPath = "/api/webhooks/trade",
	SharedSecret = "CHANGE_ME", -- use server-side env; never ship production secrets in public games
}

local function sign(tradeId: string, status: string): string
	local payload = tradeId .. status
	-- Mirror Node: crypto.createHmac('sha256', secret).update(...).digest('hex')
	-- Use a ModuleScript with HashLib or call a signing endpoint if HMAC is unavailable in your environment.
	return payload -- placeholder; replace with real HMAC if available
end

local function notify(tradeId: string, robloxTradeId: string, status: string)
	local body = {
		tradeId = tradeId,
		robloxTradeId = robloxTradeId,
		status = status,
		signature = sign(tradeId, status),
	}
	local url = CONFIG.ApiBase .. CONFIG.WebhookPath
	local ok, res = pcall(function()
		return HttpService:PostAsync(url, HttpService:JSONEncode(body), Enum.HttpContentType.ApplicationJson)
	end)
	if not ok then
		warn("[RG] webhook failed", res)
	end
end

-- Example: call notify(...) from your trade verification flow once you have tradeId + robloxTradeId + status.

return {
	Notify = notify,
}
