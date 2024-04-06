import { Box, Button, CircularProgress, Paper, Typography } from '@mui/material'
import { LoadingButton } from '@mui/lab'

import { invoke } from '@tauri-apps/api'
import React, { useContext, useEffect, useMemo, useState } from 'react'

import { CreateBatchModal } from '../../components/CreateBatchModal'
import { CreateUnitModal } from '../../components/CreateUnitModal'
import { Row, Table } from '../../components/Table'
import { GlobalContext } from '../../context'
import { AccountState, HeadCell, Unit } from '../../types'
import {
  convertMsToTime,
  getBatchAccount,
  transformAccountStatesToUnits,
} from '../../utils'

const UNIT_RECREATE_TIMIMG = 3600000

const createRows = (
  units: Unit[],
  closingUnitAsset: string,
  reCreatingUnitAssets: string[],
  handleAction?: (type: 'close_unit', unit: Unit) => void,
): Row[] => {
  return units.map(unit => ({
    id: unit.base_unit_info.asset,
    data: [
      <div>
        <strong>{unit.base_unit_info.asset}</strong>
        {reCreatingUnitAssets.includes(unit.base_unit_info.asset) ? (
          <div>
            Recreating <CircularProgress size={28} />
          </div>
        ) : (
          <div>
            Time opened:{' '}
            {convertMsToTime(Date.now() - unit.base_unit_info.timestamp)}
          </div>
        )}
      </div>,
      <div>
        <div>Amount: {unit.positions.length}</div>

        <div>
          Sizes: {unit.positions?.[0]?.info.szi} /{' '}
          {unit.positions?.[1]?.info.szi}
        </div>
        <div>
          Liq price: {unit.positions?.[0]?.info.liquidationPx} /{' '}
          {unit.positions?.[1]?.info.liquidationPx}
        </div>
      </div>,
      <div>
        <div>Amount: {unit.orders.length}</div>
        <div>
          Sizes: {unit.orders?.[0]?.info.origSz} /{' '}
          {unit.orders?.[1]?.info.origSz}
        </div>
        <div>
          Limit px: {unit.orders?.[0]?.info.limitPx} /{' '}
          {unit.orders?.[1]?.info.limitPx}
        </div>
      </div>,
      <Box sx={{ display: 'flex', width: '100%', justifyContent: 'center' }}>
        <LoadingButton
          variant='contained'
          color='error'
          loading={unit.base_unit_info.asset === closingUnitAsset}
          onClick={() => handleAction && handleAction('close_unit', unit)}
        >
          Close Unit
        </LoadingButton>
      </Box>,
    ],
  }))
}

const headCells: HeadCell[] = [
  {
    id: 'asset',
    align: 'left',
    disablePadding: false,
    label: <Typography>Asset</Typography>,
  },
  {
    id: 'positions',
    align: 'center',
    disablePadding: false,
    label: <Typography>Opened positions</Typography>,
  },
  {
    id: 'orders',
    align: 'center',
    disablePadding: false,
    label: <Typography>Opened limit orders</Typography>,
  },
  {
    id: 'actions',
    align: 'center',
    disablePadding: false,
    label: <Typography>Actions</Typography>,
  },
]

const Batch: React.FC<{
  account_id_1: string
  account_id_2: string
  id: string
}> = ({ account_id_1, account_id_2, id }) => {
  const [modalId, setModalId] = useState<string | null>(null)
  const { accounts, getAccountProxy, closeBatch } = useContext(GlobalContext)

  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [closingUnitAsset, setClosingUnitAsset] = useState('')
  const [reCreatingUnitAssets, setReCreatingUnitAssets] = useState<string[]>([])

  const account_1 = accounts.find(({ id }) => id === account_id_1)!
  const account_2 = accounts.find(({ id }) => id === account_id_2)!

  const [balances, setBalances] = useState<Record<string, string>>({})

  const [accountStates, setAccountState] = useState<
    Record<string, AccountState>
  >({})

  const [sockets, setSockets] = useState<Record<string, WebSocket | null>>({
    [account_1.public_address]: null,
    [account_2.public_address]: null,
  })

  const [socket_1, socket_2] = useMemo(
    () => [
      sockets[account_1.public_address],
      sockets[account_2.public_address],
    ],
    [sockets],
  )

  useEffect(() => {
    if (
      accountStates[account_1.public_address] &&
      accountStates[account_2.public_address]
    ) {
      setLoading(false)
    }
  }, [accountStates])

  const units = useMemo(
    () => transformAccountStatesToUnits(Object.values(accountStates)),
    [accountStates],
  )

  useEffect(() => {
    units.forEach(unit => {
      if (
        unit.base_unit_info.timestamp &&
        Date.now() - unit.base_unit_info.timestamp >= UNIT_RECREATE_TIMIMG
      ) {
        if (
          reCreatingUnitAssets.includes(unit.base_unit_info.asset) ||
          closingUnitAsset === unit.base_unit_info.asset
        ) {
          return
        }
        setReCreatingUnitAssets(prev => [...prev, unit.base_unit_info.asset])
        invoke('close_and_create_same_unit', {
          account1: getBatchAccount(account_1, getAccountProxy(account_1)),
          account2: getBatchAccount(account_2, getAccountProxy(account_2)),
          asset: unit.base_unit_info.asset,
          sz: unit.base_unit_info.size,
          leverage: unit.base_unit_info.leverage,
        }).then(() => {
          setReCreatingUnitAssets(prev =>
            prev.filter(asset => asset !== unit.base_unit_info.asset),
          )
        })
      }
    })
  }, [units, reCreatingUnitAssets])

  const handleAction = (type: 'close_unit', unit: Unit) => {
    if (type === 'close_unit') {
      setClosingUnitAsset(unit.base_unit_info.asset)
      invoke('close_unit', {
        account1: getBatchAccount(account_1, getAccountProxy(account_1)),
        account2: getBatchAccount(account_2, getAccountProxy(account_2)),
        asset: unit.base_unit_info.asset,
      }).then(() => {
        setClosingUnitAsset('')
      })
    }
  }

  const rows = useMemo(
    () =>
      createRows(units, closingUnitAsset, reCreatingUnitAssets, handleAction),
    [units, closingUnitAsset, reCreatingUnitAssets],
  )

  const handleCreateUnit = (form: {
    asset: string
    sz: number
    leverage: number
  }) => {
    setIsCreating(true)
    invoke('create_unit', {
      account1: getBatchAccount(account_1, getAccountProxy(account_1)),
      account2: getBatchAccount(account_2, getAccountProxy(account_2)),
      asset: form.asset,
      sz: Number(form.sz),
      leverage: Number(form.leverage),
    }).then(() => {
      setModalId(null)
      setIsCreating(false)
    })
  }

  const toolbar = () => {
    return (
      <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant='contained'
          color='primary'
          disabled={loading}
          onClick={() => setModalId('createUnitModal')}
        >
          Create Unit
        </Button>
      </Box>
    )
  }

  useEffect(() => {
    const connect = (conId: '1' | '2') => {
      const con = new WebSocket('wss://api.hyperliquid.xyz/ws')
      const account = conId === '1' ? account_1 : account_2

      con.onopen = () => {
        setSockets(prev => ({ ...prev, [account.public_address]: con }))
      }

      con.onclose = () => {
        setSockets(prev => ({ ...prev, [account.public_address]: null }))
        connect(conId)
      }

      con.onerror = () => {
        con.close()
      }
    }

    connect('1')
    connect('2')
  }, [])

  useEffect(() => {
    if (socket_2) {
      socket_2.send(
        JSON.stringify({
          method: 'subscribe',
          subscription: { type: 'webData2', user: account_2.public_address },
        }),
      )

      socket_2.onmessage = (ev: MessageEvent<any>) => {
        const data = JSON.parse(ev.data)
        if (data?.channel === 'webData2') {
          const accountState = data.data as AccountState
          setAccountState(prev => ({
            ...prev,
            [account_2.public_address]: accountState,
          }))
          setBalances(prev => ({
            ...prev,
            [account_2.public_address]:
              accountState.clearinghouseState.marginSummary.accountValue,
          }))
        }
      }
    }
  }, [socket_2])

  useEffect(() => {
    if (socket_1) {
      socket_1.send(
        JSON.stringify({
          method: 'subscribe',
          subscription: { type: 'webData2', user: account_1.public_address },
        }),
      )
      socket_1.onmessage = (ev: MessageEvent<any>) => {
        const data = JSON.parse(ev.data)
        if (data?.channel === 'webData2') {
          const accountState = data.data as AccountState
          setAccountState(prev => ({
            ...prev,
            [account_1.public_address]: accountState,
          }))
          setBalances(prev => ({
            ...prev,
            [account_1.public_address]:
              accountState.clearinghouseState.marginSummary.accountValue,
          }))
        }
      }
    }
  }, [socket_1])

  return (
    <Paper sx={{ width: '100%', p: 2 }}>
      <CreateUnitModal
        handleCreateUnit={handleCreateUnit}
        open={modalId === 'createUnitModal'}
        isCreating={isCreating}
        handleClose={() => setModalId(null)}
      />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          justifyContent: 'space-between',
        }}
      >
        <Typography>
          Batch ID: <strong>{id}</strong>
        </Typography>
        <Box>
          <Button
            variant='contained'
            color='error'
            onClick={() => closeBatch(id)}
            disabled={Boolean(loading || units.length)}
            //disabled={!form.asset || !form.sz || !form.leverage}
          >
            Close Batch
          </Button>
        </Box>
      </Box>

      <Typography>
        Account 1 public_address: <strong>{account_1.public_address}</strong>{' '}
        balance: {balances[account_1.public_address]}$
      </Typography>
      <Typography>
        Account 2 public_address: <strong>{account_2.public_address}</strong>{' '}
        balance: {balances[account_2.public_address]}$
      </Typography>
      <Table
        headCells={headCells}
        loading={loading}
        rows={rows}
        pagination={false}
        toolbar={toolbar()}
      />
    </Paper>
  )
}

export const Batches: React.FC = () => {
  const { batches } = useContext(GlobalContext)

  const [modalId, setModalId] = React.useState<string | null>(null)

  return (
    <Box sx={{ width: '100%' }}>
      <CreateBatchModal
        open={modalId === 'createBatchModal'}
        handleClose={() => setModalId(null)}
      />
      <Button
        variant='contained'
        color='primary'
        onClick={() => setModalId('createBatchModal')}
      >
        Create Batch
      </Button>
      <Box
        sx={{
          width: '100%',
          mt: 2,
          gap: 5,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {batches.map(batch => {
          return (
            <Batch
              account_id_1={batch.account_1_id!}
              account_id_2={batch.account_2_id!}
              id={batch.id!}
              key={batch.id}
            />
          )
        })}
      </Box>
    </Box>
  )
}
