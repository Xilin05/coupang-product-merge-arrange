const { createApp, ref, reactive, onMounted, watch } = Vue;

const APP = createApp({
  setup() {
    let products = ref(window.my_app_data?.productList || []);
    let mergeProducts = ref([]);

    function openCoupangLink(payload) {
      // console.log(
      //   `https://www.coupang.com/vp/products/${payload?.PID}?vendorItemId=${payload?.VID}`
      // );

      window.open(
        `https://www.coupang.com/vp/products/${payload?.PID}?vendorItemId=${payload?.VID}`,
        "_blank"
      );
    }

    const productFileList = ref([]);

    function handleRemove(file) {
      productFileList.value = productFileList.value.filter(
        f => f.uid !== file.uid
      );
    }

    function formatSize(bytes) {
      if (!bytes) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    /** excel文件处理 - 开始 */
    // 用于存储解析后的JSON数据
    const jsonData = ref([]);

    // 处理文件变化的函数
    const handleFileChange = uploadFile => {
      const file = uploadFile.raw; // 获取原始的File对象
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = e => {
        try {
          // 1. 读取文件内容为ArrayBuffer
          const data = new Uint8Array(e.target.result);

          // 2. 使用SheetJS解析Excel工作簿
          const workbook = XLSX.read(data, { type: "array" });

          // 3. 获取第一个工作表(Sheet)的名称
          const firstSheetName = workbook.SheetNames[0];
          // 4. 根据工作表名称获取具体的工作表对象
          const worksheet = workbook.Sheets[firstSheetName];

          // 5. 将工作表数据转换为JSON对象数组
          // header: 1 代表将第一行作为数据头（属性名），后续行作为数据记录
          // 如果Excel没有表头，可以使用 {header: 1} 将其转换为二维数组，或者省略header选项
          const dataArray = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          console.log("dataArray", dataArray);

          // 处理转换后的数据（示例：假设第一行是标题行）
          if (dataArray.length > 0) {
            const headers = dataArray[0]; // 第一行作为键(keys)
            const result = [];
            for (let i = 1; i < dataArray.length; i++) {
              const row = dataArray[i];
              const obj = {};
              headers.forEach((header, index) => {
                obj[header] = row[index]; // 或使用 header 作为键，row[index] 作为值
              });
              result.push(obj);
            }
            jsonData.value = result;
          } else {
            // 如果没有标题行，直接将所有行作为数据
            jsonData.value = dataArray;
          }

          ElementPlus.ElMessage.success("文件解析成功！");
          console.log("解析后的JSON数据:", jsonData.value); // 在控制台查看完整数据
        } catch (error) {
          console.error("解析Excel文件时出错:", error);
          ElementPlus.ElMessage.error("文件解析失败，请检查文件格式。");
        }
      };

      // 以ArrayBuffer格式读取文件，这是SheetJS所需要的
      reader.readAsArrayBuffer(file);
    };
    /** excel文件处理 - 结束 */

    /** 前期整理数据：筛选被合并曝光的产品 - 开始 */
    let checkMergeObj = ref({});
    let mergeInfoList = ref([]);
    let mergeInfoListBackUp = [];
    /** 
    循环遍历产品数组
    检查当前曝光id是否已经记录在案
    不在：则新增一个字段，key是当前产品信息对象的曝光id
    存在：
      检查当前曝光id的字段信息数组是否已经记录当前产品信息对象的注册商品ID：
        存在：跳过
        不存在：当前曝光id的字段信息数组插入当前产品信息对象的注册商品id
    */

    function formatMergeData() {
      window.my_app_data.productList?.forEach(product => {
        if (product["PID"] in checkMergeObj.value) {
          if (
            checkMergeObj.value[product["PID"]].ridList.indexOf(
              product["RID"]
            ) === -1
          ) {
            checkMergeObj.value[product["PID"]].ridList.push(product["RID"]);
            checkMergeObj.value[product["PID"]].skuList.push(product);
            checkMergeObj.value[product["PID"]][product["RID"]] = product;
          }
        } else {
          checkMergeObj.value[product["PID"]] = {};
          checkMergeObj.value[product["PID"]].skuList = [];
          checkMergeObj.value[product["PID"]].skuList.push(product);
          checkMergeObj.value[product["PID"]].ridList = [product["RID"]];
          checkMergeObj.value[product["PID"]][product["RID"]] = product;
        }
      });

      // console.log(Object.keys(checkMergeObj.value).length, checkMergeObj.value);

      let resObj = {};
      for (let key in checkMergeObj.value) {
        if (checkMergeObj.value[key].ridList.length > 1) {
          resObj = { ...checkMergeObj.value[key] };
          resObj["PID"] = key;

          mergeInfoList.value.push(resObj);
          resObj = {};
        }
      }

      console.log("筛选存在重复的曝光id", mergeInfoList.value);
    }

    formatMergeData();

    function sortSamePID(list, isInit = false) {
      let tempList = [];

      if (isInit) {
        list.forEach(item => {
          let filterRes = products.value.filter(
            product => product.PID === item.PID
          );
          tempList.push(...filterRes);
        });
      } else {
        let tempPidList = [];
        list.forEach(item => {
          if (!tempPidList.includes(item.PID)) tempPidList.push(item.PID);
        });

        tempPidList.forEach(pid => {
          let filterRes = list.filter(item => item.PID === pid);
          tempList.push(...filterRes);
        });
      }

      return tempList;
    }

    /** 整理被合并的产品数据并展示到表格 ---结束 */
    let pidObj = {};
    function formatListData(list, isInit = false) {
      list.forEach((element, index) => {
        let count = list.filter(item => item.PID === element.PID).length;

        if (pidObj?.[element.PID]) {
          pidObj[element.PID] += 1;
        } else {
          pidObj[element.PID] = 1;
        }

        element.PIDIndex = pidObj?.[element.PID];
        element.samePIDCount = count;

        element.indexRID = `${pidObj?.[element.PID]}. ${element.RID}`;
      });

      isInit && (mergeInfoListBackUp = JSON.stringify(list));
      mergeProducts.value = JSON.parse(JSON.stringify(list));
      pidObj = {};

      return list;
    }

    formatListData(sortSamePID(mergeInfoList.value, true), true);
    /** 整理被合并的产品数据并展示到表格 ---结束 */

    /** 前期整理数据：筛选被合并曝光的产品 - 结束 */
    function PIDSpanMethod({ row, column, rowIndex, columnIndex }) {
      if (columnIndex === 0) {
        if (row.PIDIndex === 1) {
          return {
            rowspan: row.samePIDCount,
            colspan: 1,
          };
        } else {
          return {
            rowspan: 0,
            colspan: 0,
          };
        }
      }
    }

    function handleCopy(
      value,
      { keepLineBreak = true, onSuccess = () => {}, onError = () => {} } = {}
    ) {
      console.log("keepLineBreak", keepLineBreak);

      try {
        // 创建元素（textarea 支持换行，input 只能单行）
        const el = keepLineBreak
          ? document.createElement("textarea")
          : document.createElement("input");

        value = mergeProducts.value.map(product => product.VID).join("\r\n");
        // 设置文本，去掉换行时替换为一个空格
        el.value = keepLineBreak ? value : value.replace(/\n/g, " ");

        // 防止页面滚动闪动
        el.style.position = "fixed";
        el.style.top = "-9999px";
        el.style.left = "-9999px";
        el.style.opacity = "0";

        document.body.appendChild(el);
        el.select();
        el.setSelectionRange(0, el.value.length); // 移动端兼容

        const success = document.execCommand("copy");

        document.body.removeChild(el);

        if (success) {
          onSuccess();
          ElementPlus.ElMessage.success("复制成功");
        } else {
          throw new Error("复制命令返回 false");
        }
      } catch (err) {
        ElementPlus.ElMessage.error("复制失败");
        console.error("复制失败:", err);
        onError(err);
      }

      // return mergeProducts.value.map((product) => product.VID).join("\r\n");
    }

    // 搜索相关数据与逻辑
    const tableLoading = ref(false);
    const defaultForm = {
      RID: "",
      RID_exclude: false,
      PID: "",
      PID_first: true,
      union: 0,
    };

    const searchForm = ref({});

    function handleReset() {
      ElementPlus.ElMessage.success("已重置");
      searchForm.value = JSON.parse(JSON.stringify(defaultForm));
      mergeProducts.value = JSON.parse(mergeInfoListBackUp);
    }

    onMounted(() => {
      searchForm.value = JSON.parse(JSON.stringify(defaultForm));
    });

    function checkSearch() {
      return JSON.stringify(searchForm.value) == JSON.stringify(defaultForm);
    }

    function filterRID() {
      let filterRes = JSON.parse(mergeInfoListBackUp).filter(
        info => info.RID === searchForm.value.RID
      );

      return filterRes;
    }

    function filterRIDExclude() {
      let filterRes = JSON.parse(mergeInfoListBackUp).filter(
        info => info.RID !== searchForm.value.RID
      );

      return filterRes;
    }

    /**
     * 循环遍历产品列表
     * 1. 判断是否填写商品曝光id，是否填写商品注册id
     *   是/否：每个产品信息采用“或”
     * 2. 判断是否勾选商品曝光id优先
     *   是：先筛选商品曝光id
     * 3. 判断是否勾选商品注册id取反
     *   是：筛选不等于填写的注册id
     */

    function handleSearch() {
      // 默认优先
      console.log("searchForm", searchForm.value);

      if (checkSearch()) {
        mergeProducts.value = JSON.parse(mergeInfoListBackUp);

        return;
      }

      let searchRes = JSON.parse(mergeInfoListBackUp);

      if (searchForm.value.PID_first) {
        searchRes = JSON.parse(mergeInfoListBackUp).filter(
          info => info.PID == searchForm.value.PID
        );
      }

      let filterRes = searchRes.filter(info => {
        // 先判断是否级联：
        //   级联：&&，不级联：||
        // 再判断是否取反：
        //   取反：!==，不取反：===
        if (searchForm.value.union === 1) {
          if (searchForm.value.RID_exclude)
            return (
              info.RID !== searchForm.value.RID &&
              info.PID == searchForm.value.PID
            );
          return (
            info.RID === searchForm.value.RID &&
            info.PID == searchForm.value.PID
          );
        } else {
          if (searchForm.value.RID_exclude)
            return (
              info.RID !== searchForm.value.RID ||
              info.PID == searchForm.value.PID
            );
          return (
            info.RID === searchForm.value.RID ||
            info.PID == searchForm.value.PID
          );
        }
      });

      console.log("最终筛选结果 - filterRes", filterRes);
      formatListData(sortSamePID(filterRes));
      // mergeProducts.value = searchRes;
    }

    function wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function handleLoading() {
      await wait(200);
      tableLoading.value = false;
    }

    watch(
      () => mergeProducts.value,
      (newVal, oldVal) => {
        tableLoading.value = true;
        handleLoading();
      },
      { deep: true }
    );

    return {
      productFileList,
      handleRemove,
      formatSize,
      jsonData,
      handleFileChange,
      products,
      mergeProducts,
      openCoupangLink,
      checkMergeObj,
      mergeInfoList,
      PIDSpanMethod,
      handleCopy,
      searchForm,
      handleReset,
      handleSearch,
      tableLoading,
    };
  },
});

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  APP.component(key, component);
}

APP.use(ElementPlus).mount("#app");
