const { createApp, ref, reactive, onMounted, watch } = Vue;

const APP = createApp({
  setup() {
    // 跳转链接前台页面
    function openCoupangLink(payload) {
      window.open(
        `https://www.coupang.com/vp/products/${payload?.PID}?vendorItemId=${payload?.VID}`,
        "_blank"
      );
    }

    // 下载模板按钮
    function downloadTemplate() {
      // 1. 定义模板表头和示例数据
      const templateData = [
        ["RID", "PID", "VID", "SKUID", "PN", "SKUNAME"], // 表头行
      ];

      // 2. 使用SheetJS创建Workbook和工作表
      const worksheet = XLSX.utils.aoa_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "产品信息模板");

      // 3. 生成Excel文件并触发下载
      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });
      const blob = new Blob([excelBuffer], {
        type: "application/octet-stream",
      });

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "Coupang产品信息导入模板.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // 释放URL对象
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
    }

    // 保存和记录上传的文件列表
    const productFileList = ref([]);

    // 移除文件
    function handleRemove(file) {
      productFileList.value = productFileList.value.filter(
        (f) => f.uid !== file.uid
      );
    }

    // 格式化文件大小，用于展示
    function formatSize(bytes) {
      if (!bytes) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    /** excel文件处理 - 开始 */
    // 检测文件上传格式是否正确
    // 定义标准表头，用于校验
    const standardHeaders = ref([
      "RID",
      "PID",
      "VID",
      "SKUID",
      "PN",
      "SKUNAME",
    ]);
    const uploadError = ref("");
    // 用于存储解析后的JSON数据
    const excelJsonData = ref([]);
    // 用于存储格式化后的数组
    const formatProductList = ref([]);
    let excelPidList = [];
    const mergeInfoList = ref([]);

    // 分析重复曝光的产品
    function analysisRepeatProduct(list) {
      excelPidList.forEach((pid) => {
        const filterIPIDRes = list.filter((item) => item.PID == pid);
        // const filterRepeatRes = group.filter((item, index, self) => self.findIndex(el => el.RID == item.RID) === index)
        const filterRepeatRes = filterIPIDRes.reduce((acc, curr) => {
          if (!acc.some((product) => product.RID === curr.RID)) {
            acc.push(curr);
          }
          return acc;
        }, []);

        if (filterRepeatRes.length > 1) {
          mergeInfoList.value.push({
            PID: pid,
            productList: filterRepeatRes,
          });
        }
      });
    }

    // 上传文件后，处理文件数据
    const handleFileChange = (uploadFile) => {
      const file = uploadFile.raw;
      if (!file) return;

      uploadError.value = ""; // 清空错误信息

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // 将工作表数据转换为JSON
          const dataArray = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          // console.log("excel表格转换的数据，dataArray", dataArray);

          if (dataArray.length === 0) {
            ElementPlus.ElMessage.error("检测表格内容为空，请检查上传的文件");
            throw new Error("文件内容为空");
          }

          // 获取用户文件的表头
          const userFileHeaders = dataArray[0];

          // 校验表头是否匹配
          const isValid = validateHeaders(
            userFileHeaders,
            standardHeaders.value
          );

          if (!isValid) {
            uploadError.value = `文件表头不符合模板要求。请下载最新模板并按模板格式填写。`;
            ElementPlus.ElMessage.error(uploadError.value);
            return;
          }

          // 表头校验通过，处理数据（跳过表头行）
          const dataWithoutHeader = dataArray.slice(1);
          processData(dataWithoutHeader);

          ElementPlus.ElMessage.success("文件校验成功，数据导入中...");

          const formatRes = handleFormat(excelJsonData.value);
          formatProductListBackUp = [...formatRes];
          formatProductList.value = formatRes;
          analysisRepeatProduct(formatRes);

          console.log("formatProductList", formatProductList.value);
        } catch (error) {
          console.error("文件处理失败:", error);
          ElementPlus.ElMessage.error(`文件处理失败: ${error.message}`);
        }
      };

      reader.readAsArrayBuffer(file);
    };

    // 校验表头函数
    const validateHeaders = (userHeaders, standardHeaders) => {
      if (userHeaders.length !== standardHeaders.length) {
        return false;
      }

      for (let i = 0; i < standardHeaders.length; i++) {
        if (userHeaders[i] !== standardHeaders[i]) {
          return false;
        }
      }

      return true;
    };

    // 处理有效数据
    const processData = (dataArray) => {
      excelJsonData.value = dataArray.map((row, index) => {
        return {
          RID: row[0] || "",
          PID: row[1] || "",
          VID: row[2] || "",
          SKUID: row[3] || "",
          PN: row[4] || "",
          SKUNAME: row[5] || "",
        };
      });
      ElementPlus.ElMessage.success(
        `文件解析成功，共${dataArray.length}条数据。`
      );

      console.log("解析后的数据:", excelJsonData.value);
      // 这里可以继续处理数据，如发送到后端等
    };

    /**
     * 循环遍历产品数组
     * 检查当前曝光id是否已经记录在案
     * 不在：则新增一个字段，key是当前产品信息对象的曝光id
     * 存在：检查当前曝光id的字段信息数组是否已经记录当前产品信息对象的注册商品ID：
     *  存在：跳过
     *  不存在：当前曝光id的字段信息数组插入当前产品信息对象的注册商品id
     */

    function handleFormat(list) {
      const groups = {};
      const pidList = [];
      /**
       * 合并描述 需要的数据：
       * 1. 存在合并曝光的商品id
       * 2. 每个合并曝光的关联产品数
       * 3. 每个合并曝光相关的产品注册名称
       */

      list.forEach((element) => {
        let pid = element.PID;
        if (!(pid in groups)) {
          groups[pid] = [];
          pidList.push(pid);
        }

        groups[pid].push(element);

        /**
         * 记录曝光id的第一个产品信息：注册商品id，注册商品名
         * 判断产品信息是否已经存在，是则跳过不记录，不是则再塞进一个新的产品信息
         * 最后判断哪个曝光id下面有超过1个的产品信息，则为存在合并曝光的商品
         */
      });

      const result = [];
      pidList.forEach((pid) => {
        const group = groups[pid];

        group.forEach((item, index) => {
          result.push({
            ...item,
            groupIndex: index + 1,
            groupCount: group.length,
            groupIndexShow: `${index + 1}. ${item.RID}`,
          });
        });
      });

      excelPidList = [...pidList];

      return result;
    }
    /** excel文件处理 - 结束 */

    // 这里是针对跨境店 - 粘贴html代码，分析并整理获取数据
    const dialogVisible = ref(false);
    const parseLoading = ref(false);
    const htmlContent = ref("");

    function handleDialogClose(done) {
      // ElementPlus.ElMessageBox.confirm(
      //   "确定关闭当前弹窗吗？未保存的数据将丢失。",
      //   "提示",
      //   {
      //     type: "warning",
      //   }
      // )
      //   .then(() => {
      //     done();
      //   })
      //   .catch(() => {
      //     // catch error
      //   });
    }

    // ========== 工具函数 ========== 开始
    // 安全获取元素文本内容
    const getSafeText = (element, selector = null) => {
      try {
        const target = selector ? element?.querySelector(selector) : element;
        return target?.innerText?.trim() || "";
      } catch {
        return "";
      }
    };

    // 安全获取元素属性
    const getSafeAttribute = (element, attribute) => {
      try {
        return element?.[attribute] || "";
      } catch {
        return "";
      }
    };

    // 从文本中提取ID（如："注册商品ID 15698745841"）
    const extractIdFromText = (text, prefix) => {
      if (!text) return "";
      const match = text.match(new RegExp(`${prefix}\\s+(\\d+)`));
      return match?.[1] || "";
    };

    // 从元素中提取ID
    const extractIdFromElement = (element, prefix) => {
      return extractIdFromText(getSafeText(element), prefix);
    };
    // ========== 工具函数 ========== 结束

    function parseParentRow(row) {
      const ipContainer = row.querySelector(".ip-container");
      if (!ipContainer) {
        throw new Error("未找到 ip-container 元素");
      }

      const ipRight = ipContainer.querySelector(".ip-right");
      const productInfo = ipRight?.querySelector(".ip-content");

      return {
        rowIndex: row.rowIndex,
        PN: getSafeText(ipContainer, ".ip-title"),
        shipmentMethod: getSafeText(productInfo?.children[0]),
        RID: extractIdFromText(
          getSafeText(productInfo?.children[2]),
          "注册商品ID"
        ),
      };
    }

    function parseChildRow(row, parentProduct) {
      const ipContainer = row.querySelector(".ip-container");
      if (!ipContainer) {
        throw new Error("未找到 ip-container 元素");
      }

      const productInfo = ipContainer.querySelector(".ip-right");
      const ipLeft = ipContainer.querySelector(".ip-left");

      return {
        ...parentProduct, // 展开父级产品信息
        SKUNAME: getSafeText(productInfo, ".ip-title"),
        SKU_shipmentMethod: getSafeText(
          productInfo,
          ".ip-content-registration-type"
        ),
        SKUID: extractIdFromElement(
          productInfo?.children[2]?.children[0],
          "选项ID"
        ),
        VID: extractIdFromElement(
          productInfo?.children[2]?.children[0],
          "选项ID"
        ),
        PID: extractIdFromElement(
          productInfo?.children[2]?.children[2],
          "商品ID"
        ),
        skuImgurl: getSafeAttribute(ipLeft?.children[0], "src"),
        itemRowIndex: row.rowIndex, // 添加当前行的索引
      };
    }

    function parseProductList(productHtmlList) {
      const result = [];
      let currentParent = null;

      productHtmlList.forEach((row, index) => {
        if (row.className === "table-header") {
          return; // 使用 return 提前退出当前迭代
        }

        try {
          if (row.className == "inventory-line") {
            currentParent = parseParentRow(row);
          }

          if (row.className == "item-line" && currentParent) {
            const childRow = parseChildRow(row, currentParent);
            result.push(childRow);
          }
        } catch (error) {
          console.error(`处理第 ${index} 行时出错:`, error);
        }
      });

      return result;
    }

    function parseHTMLContent() {
      // parseLoading.value = true;
      // 1. 使用DOMParser解析HTML字符串
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent.value, "text/html");

      // 2. 准备一个数组来存储提取到的产品信息
      // const productList = [];

      // 3. 根据Coupang页面的实际结构，使用选择器定位产品元素
      // 注意：以下选择器是示例，您需要通过检查Coupang页面来确定正确的选择器
      // 可能的元素：包含产品信息的div，类名可能是 '.product', '.prod-item', '[data-product-id]' 等
      const productElements = doc.querySelectorAll(".list-container"); // 请替换为实际的选择器
      console.log("productElements", productElements);

      if (productElements.length === 0) {
        ElementPlus.ElMessage.error(
          "未在粘贴的HTML中发现产品列表，请确认复制了正确区域。"
        );
        parseLoading.value = false;
        return;
      }

      const productHtmlList = Array.from(
        productElements?.[0]?.children?.[0]?.children?.[1]?.children
      );
      console.log("productHtmlList", productHtmlList);

      const result = parseProductList(productHtmlList);
      console.log("解析完成后 result", result);

      // 整理解析出来的产品数据，并发布到表格，展示数据
      formatProductList.value = handleFormat(result);

      ElementPlus.ElMessage.success(
        `HTML内容解析成功，共解析出${formatProductList.value.length}条产品数据。`
      );

      parseLoading.value = false;
      // dialogVisible.value = false
    }

    // 图片预览相关数据与方法
    const imagePreviewUrl = ref("");
    const imageRef = ref();
    const showImagePreview = ref(false);

    function handleImagePreview(url) {
      imagePreviewUrl.value = url;
      showImagePreview.value = true;
    }

    /** 前期整理数据：筛选被合并曝光的产品 - 结束 */
    function PIDSpanMethod({ row, column, rowIndex, columnIndex }) {
      if (columnIndex === 0) {
        if (row.groupIndex === 1) {
          return {
            rowspan: row.groupCount,
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
      {
        mode = "all",
        keepLineBreak = true,
        onSuccess = () => {},
        onError = () => {},
      } = {}
    ) {
      console.log("keepLineBreak", keepLineBreak);
      console.log("value", value);

      try {
        // 创建元素（textarea 支持换行，input 只能单行）
        const el = keepLineBreak
          ? document.createElement("textarea")
          : document.createElement("input");

        if (mode === "single") {
          value = value || "";
        } else {
          value = formatProductList.value
            .map((product) => product.VID)
            .join("\r\n");
        }
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
      formatProductList.value = [...formatProductListBackUp];
    }

    onMounted(() => {
      searchForm.value = JSON.parse(JSON.stringify(defaultForm));
    });

    /**
     * 检查搜索条件是否成立
     * true: 进行过滤搜索动作
     * false: 恢复表格数据
     * @returns true / false
     */
    function checkSearch() {
      if (!searchForm.value.RID && !searchForm.value.PID) return false;
      return JSON.stringify(searchForm.value) != JSON.stringify(defaultForm);
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
      // 默认曝光id优先
      if (!checkSearch()) {
        formatProductList.value = [...formatProductListBackUp];

        return;
      }

      const { union, RID, RID_exclude, PID, PID_first } = searchForm.value;
      let searchList = [...formatProductListBackUp];

      if (PID_first) {
        searchList = searchList.filter((info) => info.PID == PID);
      }

      searchList = searchList.filter((info) => {
        let ridMatch = info.RID == RID;
        let pidMatch = info.PID == PID;

        // 先判断是否级联：
        //   级联：&&，不级联：||
        // 再判断是否取反：
        //   取反：!==，不取反：===
        if (union === 1) {
          return RID_exclude ? !ridMatch && pidMatch : ridMatch && pidMatch;
        } else {
          return RID_exclude ? !ridMatch || pidMatch : ridMatch || pidMatch;
        }
      });

      console.log("最终筛选结果 - filterRes", searchList);
      formatProductList.value = [...handleFormat(searchList)];
    }

    function wait(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function handleLoading() {
      await wait(200);
      tableLoading.value = false;
    }

    watch(
      () => formatProductList.value,
      (newVal, oldVal) => {
        tableLoading.value = true;
        handleLoading();
      },
      { deep: true }
    );

    return {
      downloadTemplate,

      // excel文件上传 - 相关数据与方法
      productFileList,
      handleRemove,
      formatSize,
      handleFileChange,
      openCoupangLink,
      formatProductList,
      mergeInfoList,

      // 跨境店 - 相关数据与方法
      dialogVisible,
      parseLoading,
      htmlContent,
      parseHTMLContent,
      handleDialogClose,

      // 表格 - 相关数据与方法
      PIDSpanMethod,
      imagePreviewUrl,
      imageRef,
      showImagePreview,
      handleImagePreview,
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
