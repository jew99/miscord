import fetchJSON from '/static/js/fetchJSON.js'
import parseHTML from '/static/js/parseHTML.js'
import handleError from '/static/js/handleError.js'
import initSelects from '/static/js/initSelects.js'
import collapsible from '/static/dashboard/js/connections/collapsible.js'
import AddConnectionLevel from '/static/dashboard/js/connections/add.js'

const container = document.querySelector('#connections')

Promise.all([
  fetchJSON('/connections'),
  fetchJSON('/discord/channels'),
  fetchJSON('/messenger/threads')
])
  .then(([ connections, guilds, threads ]) => {
    const categoryName = (guild, catID) => catID ? '[' + guild.channels.find(chan => chan.id === catID).name + ']' : ''

    function endpointName (endpoint) {
      if (endpoint.type === 'discord') {
        const guild = guilds.find(guild => guild.channels.some(channel => channel.id === endpoint.id))
        const channel = guild.channels.find(channel => channel.id === endpoint.id)
        return [
          `${guild.name}:`,
          categoryName(guild, channel.category),
          `#${endpoint.name}`
        ].join(' ')
      } else {
        return endpoint.name
      }
    }

    function endpointLink (endpoint) {
      if (endpoint.type === 'discord') {
        const guild = guilds.find(guild => guild.channels.some(channel => channel.id === endpoint.id))
        return `https://discordapp.com/channels/${guild.id}/${endpoint.id}`
      } else {
        return `https://messenger.com/t/${endpoint.id}/`
      }
    }

    const Endpoint = endpoint => `
      <div class="box endpoint">
        <img class="icon" src="/static/img/${endpoint.type}.png" alt="${endpoint.type} logo">
        <a href="${endpointLink(endpoint)}">${endpointName(endpoint)}</a>
        <button style="margin-left: auto;" class="delete" aria-label="delete" data-id="${endpoint.id}"></button>
      </div>
    `
    const disabledStyle = ' style="color: #aaa; text-decoration: line-through; font-weight: lighter;"'

    const Connection = conn => parseHTML(`
      <article class="message connection">
        <header class="message-header">
          <p${conn.disabled ? disabledStyle : ''}>${conn.name}</p>
          <div class="icons" hidden>icons go here</div>
          <button class="delete" aria-label="delete"></button>
        </header>
        <div class="message-body">
          <input type="checkbox" class="disable-checkbox" ${conn.disabled ? 'checked' : ''}> Disabled<br />
          ${conn.endpoints.length ? conn.endpoints.map(Endpoint).join('\n') : '<b>No endpoints!</b>'}
          <select name="discord-endpoints" class="discord-channel-select">
            <option></option>
          </select>
          <br />
          <select name="messenger-endpoints" class="messenger-thread-select">
            <option></option>
         </select>
        </div>
      </div>
    `)

    function loadConnection (connection) {
      const el = Connection(connection)

      const refresh = async conn => {
        if (!conn) conn = await fetchJSON(`/connections/${connection.name}`)
        const newEl = loadConnection(conn)
        el.parentNode.replaceChild(newEl, el)
        initSelects({ guilds, threads })
      }

      el.querySelector('.disable-checkbox').addEventListener('click', async () => {
        const action = connection.disabled ? 'enable' : 'disable'
        const conn = await fetchJSON(`/connections/${connection.name}/${action}`, 'POST')
        await refresh(conn)
      })

      el.querySelector('.delete').addEventListener('click', async () => {
        if (confirm(`Do you want to delete connection ${connection.name}?`)) {
          await fetchJSON(`/connections/${connection.name}`, 'DELETE')
          location.reload()
        }
      })

      el.querySelectorAll('.endpoint > .delete').forEach(button => {
        button.addEventListener('click', async ev => {
          await fetchJSON(`/connections/${connection.name}/endpoints/${ev.target.dataset.id}`, 'DELETE')
          await refresh()
        })
      })

      const discordEndpoints = $(el).find('.discord-channel-select')
      const messengerEndpoints = $(el).find('.messenger-thread-select')

      async function addEndpoint (type, id) {
        discordEndpoints.prop('disabled', true)
        messengerEndpoints.prop('disabled', true)
        await fetchJSON(`/connections/${connection.name}/endpoints`, { type, id })
        await refresh()
      }

      discordEndpoints.change(ev => addEndpoint('discord', ev.target.value))
      messengerEndpoints.change(ev => addEndpoint('messenger', ev.target.value))

      collapsible(el)

      return el
    }

    if (!connections.length) {
      container.appendChild(parseHTML(`<h1 class="title">No connections!</h1>`))
    } else {
      for (let connection of connections) {
        container.appendChild(loadConnection(connection))
      }
    }

    initSelects({ guilds, threads })

    const level = new AddConnectionLevel()
    level.onadd = name => {
      const noConn = container.querySelector('h1')
      if (noConn) container.removeChild(noConn)

      container.insertBefore(loadConnection({ name, endpoints: [] }), level.el)
      initSelects({ guilds, threads })
    }
    container.appendChild(level.el)
  })
  .catch(handleError)
