import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Modal,
  Paper,
  Select,
  Box,
} from '@mui/material'
import { useContext, useState } from 'react'

import { GlobalContext } from '../../context'

export const CreateBatchModal: React.FC<{
  open: boolean
  handleClose: () => void
}> = ({ open, handleClose }) => {
  const { accounts, createBatch } = useContext(GlobalContext)
  const [batchAccounts, setBatchAccounts] = useState<{
    account_1_id: string
    account_2_id: string
  }>({
    account_1_id: '',
    account_2_id: '',
  })

  const onConfirm = () => {
    if (batchAccounts.account_1_id && batchAccounts.account_2_id) {
      createBatch(batchAccounts)
      handleClose()
    }
  }

  const onChange = (id: 'account_1_id' | 'account_2_id', v: string) => {
    setBatchAccounts(prev => ({ ...prev, [id]: v ?? '' }))
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      aria-labelledby='modal-modal-title'
      aria-describedby='modal-modal-description'
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <Paper sx={{ width: '500px', p: 2 }}>
        <Box sx={{ gap: 5, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl sx={{ m: 1, minWidth: 120 }}>
              <InputLabel id='account-label'>Account 1</InputLabel>
              <Select
                labelId='account-label'
                id='account-select'
                value={batchAccounts.account_1_id}
                label='Account 1'
                onChange={e => onChange('account_1_id', e.target.value)}
              >
                <MenuItem value=''>
                  <em>None</em>
                </MenuItem>
                {accounts
                  .filter(a => a.id !== batchAccounts.account_2_id)
                  .map(a => (
                    <MenuItem value={a.id}>{a.public_address}</MenuItem>
                  ))}
              </Select>
            </FormControl>
            <FormControl sx={{ m: 1, minWidth: 120 }}>
              <InputLabel id='account-label'>Account 2</InputLabel>
              <Select
                labelId='account-label'
                id='account-select'
                value={batchAccounts.account_2_id}
                label='Account 2'
                onChange={e => onChange('account_2_id', e.target.value)}
              >
                <MenuItem value=''>
                  <em>None</em>
                </MenuItem>
                {accounts
                  .filter(a => a.id !== batchAccounts.account_1_id)
                  .map(a => (
                    <MenuItem value={a.id}>{a.public_address}</MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Box>

          <Box
            sx={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <Button variant='contained' color='error' onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant='contained'
              color='success'
              onClick={onConfirm}
              disabled={
                !batchAccounts.account_1_id || !batchAccounts.account_2_id
              }
            >
              Confirm
            </Button>
          </Box>
        </Box>
      </Paper>
    </Modal>
  )
}
