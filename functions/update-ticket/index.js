// export interface IUpdateTicketData {
//   sessID: string
//   ticketGroup: ITicketGroup
//   clientID: string
// }

exports.main = async function (evt) {
  const tcb = require('@cloudbase/node-sdk')
  const app = tcb.init({
    env: tcb.SYMBOL_CURRENT_ENV
  })
  const db = app.database()
  if (!evt.sessID) return {
    code: 1,
    message: 'session id is required'
  }
  
  try {
    const sessions = await db
      .collection('sessions')
      .where({sessID: evt.sessID})
      .get()
    
    if (!sessions.data || !sessions.data.length) throw new Error(`meeting #${evt.sessID} not exists`)

    const clientID = evt.clientID
    const session = sessions.data[0]
    clearUsedTickets(session, clientID)

    const originalSession = JSON.parse(JSON.stringify(session))
    const chunk = {}
    const ticketGroup = evt.ticketGroup
    Object.keys(ticketGroup).forEach((peerID) => {
      const ticket = ticketGroup[peerID]
      // is from host
      if (peerID === '#1') {
        if (session.host !== clientID) {
          throw new Error(`peer client id is invalid, #1 for host only`)
        }
        if (session.firstClientTicket && session.firstClientTicket.offer.id !== clientID) {
          session.firstClientTicket = { offer: { id: clientID, ticket: []}}
        }
        // if no peer id, than store it in creator Ticket
        const firstClientTicket = session.firstClientTicket || { offer: { id: clientID, ticket: []}}
        firstClientTicket.offer.ticket.push(...ticket)
        chunk.firstClientTicket = firstClientTicket
      } else {
        const peerTickets = session.ticketHouse[evt.peerID] || {}
        const clientTicket = peerTickets[clientID] || []
        clientTicket.push(...ticket)
        peerTickets[clientID] = clientTicket
        session.ticketHouse[peerID] = peerTickets
        chunk.ticketHouse = session.ticketHouse
      }

      if (session.firstClientTicket &&
        session.firstClientTicket.answer &&
        peerID === session.firstClientTicket.answer.id) {
      
        const answerTicket = session.firstClientTicket.answer.ticket || []
        answerTicket.push(...ticket)
        chunk.firstClientTicket = session.firstClientTicket
      }
    })

    clearUnusedTickets(session, clientID)
    chunk.ticketHouse = session.ticketHouse

    await db.collection('sessions').doc(session._id).update(chunk)

    return {
      code: 0, 
      data: chunk,
      originalSession,
      evt
    }
  } catch (error) {
    return {
      code: 2,
      message: 'failed to query session info',
      extra: JSON.stringify(error)
    }
  }
}

function clearUsedTickets (session, clientID) {
  const ticketHouse = session.ticketHouse
  Object.keys(ticketHouse).forEach(cid => {
    const ticketGroup = ticketHouse[cid]
    Object.keys(ticketGroup).forEach(peerID => {
      if (cid === clientID || peerID === clientID) {
        ticketGroup[peerID] = []
      }
    })
  })
}

function clearUnusedTickets (session, clientID) {
  const ticketHouse = session.ticketHouse
  Object.keys(ticketHouse).forEach(cid => {
    const ticketGroup = ticketHouse[cid]
    Object.keys(ticketGroup).forEach(peerID => {
      // remove old offer or answer
      let tickets = ticketGroup[peerID].reverse()
      const idx = tickets.findIndex(item => item.type === 'offer' || item.type === 'answer')
      if (idx === -1) return
      tickets = tickets.slice(0, idx + 1)
      ticketGroup[peerID] = tickets.reverse()
    })
  })
}