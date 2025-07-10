import React from 'react';
import {
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Checkbox,
    ListItemText,
    OutlinedInput,
} from '@mui/material';

/**
 * VariableSelect (controlled component)
 *
 * Props:
 *  - allVarKeys: string[] – all variable keys available
 *  - selectedKeys: string[] – currently selected keys
 *  - onChange: (string[]) => void – callback when selection changes
 */
const VariableSelect = ({ allVarKeys = [], selectedKeys = [], onChange }) => {
    const isAllSelected =
        selectedKeys.length === allVarKeys.length && allVarKeys.length > 0;
    const isIndeterminate = selectedKeys.length > 0 && !isAllSelected;

    const handleChange = (event) => {
        const { value } = event.target;
        // "all" sentinel toggles everything on/off without storing it in state
        if (value.includes('all')) {
            onChange(isAllSelected ? [] : [...allVarKeys]);
            return;
        }
        onChange(value);
    };

    const renderValue = (sel) => {
        if (sel.length === 0) return 'None';
        if (sel.length === allVarKeys.length) return 'All Variables';
        return sel.join(', ');
    };

    return (
        <FormControl size="small" sx={{ width: 300, marginBottom: '8px' }}>
            <InputLabel id="vars-label" sx={{ color: 'white' }}>
                Select Variables
            </InputLabel>
            <Select
                labelId="vars-label"
                multiple
                value={selectedKeys}
                onChange={handleChange}
                input={<OutlinedInput label="Select Variables" />}
                renderValue={renderValue}
                MenuProps={{ disableAutoFocusItem: true }}
                sx={{
                    color: 'white',
                    '.MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(228, 219, 233, 0.25)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(228, 219, 233, 0.25)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(228, 219, 233, 0.25)',
                    },
                    '.MuiSvgIcon-root ': {
                        fill: 'white !important',
                    },
                }}
            >
                {/* Select / Deselect All – uses the "all" sentinel value */}
                <MenuItem value="all">
                    <Checkbox indeterminate={isIndeterminate} checked={isAllSelected} />
                    <ListItemText
                        primary={isAllSelected ? 'Deselect All' : 'Select All'}
                    />
                </MenuItem>

                {/* Variable checkboxes */}
                {allVarKeys.map((varKey) => (
                    <MenuItem key={varKey} value={varKey}>
                        <Checkbox checked={selectedKeys.indexOf(varKey) > -1} />
                        <ListItemText primary={varKey} />
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
};

export default VariableSelect;
