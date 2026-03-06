function pointToString(point) {
    const x = point.x.toFixed(3);
    const y = point.y.toFixed(3);
    const z = point.z.toFixed(3);

    return `{ x: ${x}, y: ${y}, z: ${z} }`;
}

function createFrameHTML(tagId, option) {
    const html = `<body>
                        <select>
                            <option value="op1" ${option === 'op1' ? 'selected': ''}>To Do</option>
                            <option value="op2" ${option === 'op2' ? 'selected': ''}>In Progress</option>
                            <option value="op3" ${option === 'op3' ? 'selected': ''}>Done</option>
                        </select>
                        <button style="background: #99f" class="edit">Edit task</button>
                        <button style="background: #f99" class="delete">Delete task</button>
                    </body>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0 }
                    body {margin: 0; padding: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; gap: 16px }
                    select {width: 100%; height: 32px; border-radius: 16px; text-align: center; border: none; background: #f9f9f9; color: #333; font-size: 16px; padding: 8px; }
                    button {cursor: pointer; width: 100%; border: none; color: white; padding: 8px; height: 32px; border-radius: 16px}
                </style>
                <script>
                    document.querySelector('select').addEventListener('change', (e) => {
                        console.log('selected:', e.target.value);
       
                        window.send('select-changed', "${tagId}", e.target.value);
                    })
                    document.querySelector('.edit').addEventListener('click', () => {
                        window.send('edit-tag', "${tagId}");
                    })
                    document.querySelector('.delete').addEventListener('click', () => {
                        window.send('delete-tag', "${tagId}");
                    })
                </script>
                `

    return html
}


export {
    createFrameHTML
}
