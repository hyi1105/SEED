# ALR5：跨公司公證與加密

> 對應 standard **0.2.9** 的 `trust_notary`／`crypto_envelope`／`json_and_crypto_guidance`。

## 期許

跨公司生效，類似律師見證／法院公證；並能加密保管。

## 公證

- 對 **content_hash＋時間＋身分** 背書  
- `notary_records[]` 可轉移  
- **Approve ≠ Notary**

## 加密

- 檔案加密；**手上鑰匙**或**第三方備份鑰匙**可解密  
- JSON 只放 **envelope**（alg、ciphertext_ref、recipients）  
- **私鑰不進**可轉移 JSON  

## JSON 適合嗎？

適合結構與信封；不適合機密明文與私鑰。  
模式：JSON envelope + blob + 外部金鑰保管。
