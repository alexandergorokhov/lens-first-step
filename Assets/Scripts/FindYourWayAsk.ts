// FindYourWayAsk — add-on B: when the plain words find no place, ask an LLM which places are meant
// (OpenAI through Snap's Remote Service Gateway). Owns: one chat request with a time limit. Must not:
// route or pick ids itself (Main checks the reply with parseAskReply and the router plans it).
// The gateway token lives only in the RemoteServiceGatewayCredentials component on Alex's PC; it is
// never saved in the repo (Node test R10). With no token, available() is false and nothing is sent.
import {OpenAI} from "RemoteServiceGateway.lspkg/HostedExternal/OpenAI"
import {AvaliableApiTypes, RemoteServiceGatewayCredentials} from "RemoteServiceGateway.lspkg/RemoteServiceGatewayCredentials"
import {ASK_LLM_MODEL, chatReplyContent} from "./FindYourWayFreeWalk"

export type AskLlm = (prompt: string) => Promise<string>

export class FindYourWayAsk {
  // A token is set (not the package's placeholder).
  static available(): boolean {
    const t = RemoteServiceGatewayCredentials.getApiToken(AvaliableApiTypes.OpenAI)
    return !!t && t.indexOf("[INSERT") < 0
  }

  // The reply's text; rejects on a gateway error or an empty reply.
  static ask(prompt: string): Promise<string> {
    return OpenAI.chatCompletions({
      model: ASK_LLM_MODEL,
      messages: [{role: "user", content: prompt}],
      temperature: 0,
    } as any).then((resp) => {
      const text = chatReplyContent(resp)
      if (text === null) throw new Error("no reply")
      return text
    })
  }
}

// `p`, or a rejection after `seconds` (a DelayedCallbackEvent on `script`), whichever comes first.
export function withTimeout<T>(script: BaseScriptComponent, p: Promise<T>, seconds: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let done = false
    const ev = script.createEvent("DelayedCallbackEvent")
    ev.bind(() => {
      script.removeEvent(ev)
      if (done) return
      done = true
      reject(new Error("timeout"))
    })
    ev.reset(seconds)
    p.then((v) => {
      if (done) return
      done = true
      script.removeEvent(ev)
      resolve(v)
    }, (e) => {
      if (done) return
      done = true
      script.removeEvent(ev)
      reject(e)
    })
  })
}
