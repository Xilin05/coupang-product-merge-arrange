// className
// inventory - line
// item - line
// rowIndex

// row.children[1]

// 废弃 - 不适配新的字符串，有些带“cm”有些不带
// const reg_crow = /^(\d+\*\d+)\n([^\n]+)\n选项ID\s+(\d+)\n\|\n商品ID\s+(\d+)\s*$/
// const reg_crow = /^(\d+\*\d+[^\n]*)\n([^\n]+)\n选项ID\s+(\d+)\n\|\n商品ID\s+(\d+)\s*$/
// let match = parseProductInfo(row.children[1].innerText);

function parseProductInfo(str) {
    // 使用命名捕获组的正则表达式
    let regex = /^(?<productModel>[^\n]+)\n(?<shippingMethod>[^\n]+)\n\|\n注册商品ID\s+(?<productId>\d+)$/;
    
    let match = str.match(regex);
    
    if (match) {
        // 直接从匹配的groups中提取命名组
        return match.groups;
    } else {
        // 如果格式不匹配，返回null或抛出错误
        console.error("字符串格式不匹配，无法解析");
        return null;
    }
}





let listcon = Array.from(document.getElementsByClassName('list-container')[0].children[0].children[1].children)
let plist = []

const reg_row = /^(.+)\n(.+)\n\|\n注册商品ID (\d+)$/;
const reg_crow = /^([^\n]+)\n([^\n]+)\n选项ID\s+(\d+)\n\|\n商品ID\s+(\d+)\s*$/

let tempParent = {}
let tempRow = {}

listcon.forEach((row, index) => {
    if (row.className == 'inventory-line') {
        tempParent = {}
        let match = row.children[1].innerText.match(reg_row);
        tempParent = {
            '行编号': row.rowIndex,
            // 产品型号: "BSM-030_A20250817"
            '产品型号': match[1],
            // 发货方式: "CGF LITE"
            '总-发货方式': match[2],
            // 注册商品ID: "15712184814"
            '注册商品ID': match[3],
        }
    }

    if (row.className == 'item-line') {
        if (row.rowIndex !== tempRow?.rowIndex) {
            if ('行编号' in tempRow) {
                plist.push(JSON.parse(JSON.stringify(tempRow)))
            }
        }

        let cmatch = row.children[1].innerText.match(reg_crow)
        tempRow = {
            ...tempParent,
            // 尺寸
            '尺寸': cmatch[1],
            // 发货方式
            'sku发货方式': cmatch[2],
            // 选项ID
            '选项id': cmatch[3],
            // 商品ID
            '商品id': cmatch[4]
        }
    }

    if (index == listcon.length - 1) {
        plist.push(JSON.parse(JSON.stringify(tempRow)))
    }
})

console.log(plist);

// listcon.forEach((row, index) => {
//     if (row.className == 'inventory-line') {
//         if (row.rowIndex !== tempRow?.rowIndex) {
//             ('rowIndex' in tempRow) && plist.push(JSON.parse(JSON.stringify(tempRow)))
//             tempRow = {}
//         }

//         let match = row.children[1].innerText.match(reg_row);
//         tempRow = {
//             rowIndex: row.rowIndex,
//             // 产品型号: "BSM-030_A20250817"
//             model: match[1],
//             // 发货方式: "CGF LITE"
//             shippingMethod: match[2],
//             // 显示商品ID: "15712184814"
//             dId: match[3],
//             children: []
//         } 
//     }

//     if (row.className == 'item-line') {
//         let cmatch = row.children[1].innerText.match(reg_crow)
//         tempRow?.children.push({
//             // 尺寸
//             size: cmatch[1],
//             // 发货方式
//             shippingMethod: cmatch[2],
//             // 选项ID
//             oId: cmatch[3],
//             // 商品ID
//             pId: cmatch[4]
//         })
//     }

//     if (index == listcon.length - 1) plist.push(JSON.parse(JSON.stringify(tempRow)))
// })

console.log(plist);
