/**
 * @name multistickers
 * @description lets you send up to 3 stickers and shift click stickers
 * @version 1.0.0
 * @author void
 * @updateurl https://raw.githubusercontent.com/voidfill/bdplugins/main/multistickers/multistickers.plugin.js
 */

const stickerStore = {};
const shiftEvent = {
	shouldAttach: false,
	shouldNotClose: false,
};

const dispatch = BdApi.findModuleByProps("dirtyDispatch");
const CloseExpressionPicker = BdApi.findModuleByProps("closeExpressionPicker");
const ShouldAttachSticker = BdApi.findModuleByProps("shouldAttachSticker");
const StickerPreview = BdApi.findModuleByProps("getStickerPreview");
const StickerPreviewContainer = BdApi.findModule((m) => m.type.toString().indexOf("stickerPreviewDivider") !== -1);
const stickerPreviewContainerCN = BdApi.findModuleByProps("stickerPreviewContainer").stickerPreviewContainer;
const StickerRow = BdApi.findModule((m) => m.default.type.toString().indexOf("e.isDisplayingIndividualStickers") !== -1).default;

module.exports = class multistickers {
	start() {
		BdApi.Patcher.instead("multistickers", ShouldAttachSticker, "shouldAttachSticker", (_, args, originalFunction) => {
			if (shiftEvent.shouldAttach) {
				shiftEvent.shouldAttach = false;
				return true;
			} else {
				return originalFunction.apply(null, args);
			}
		});

		BdApi.Patcher.instead("multistickers", CloseExpressionPicker, "closeExpressionPicker", (_, __, originalFunction) => {
			if (shiftEvent.shouldNotClose) {
				shiftEvent.shouldNotClose = false;
			} else {
				originalFunction();
			}
		});

		BdApi.Patcher.instead("multistickers", StickerPreview, "getStickerPreview", (_, [channelId, draftType]) => {
			return [...(stickerStore[channelId]?.[draftType] ?? [])];
		});

		BdApi.Patcher.after("multistickers", StickerPreviewContainer, "type", (_, [{ channelId, chatInputType }], ret) => {
			if (!ret) return;
			const type = chatInputType.drafts.type;
			const stickers = ret.props.children[0].props.children;
			for (const sticker of stickers) {
				const closeButton = sticker?.props?.children?.[0]?.props;
				if (closeButton) {
					closeButton.onClick = () => {
						const index = stickerStore[channelId]?.[type]?.findIndex((s) => s.id === sticker.key);
						if (index === -1) return;
						stickerStore[channelId][type].splice(index, 1);
						StickerPreview.emitChange();
					};
				}
			}
			return ret;
		});

		BdApi.Patcher.after("multistickers", StickerRow, "type", (_, __, ret) => {
			for (const stickerGridcell of ret.props.children) {
				const cellProps = stickerGridcell.props.children.props;
				const oldOnClick = cellProps.onClick;
				cellProps.onClick = (e) => {
					if (e.shiftKey) {
						shiftEvent.shouldAttach = true;
						shiftEvent.shouldNotClose = true;
					}
					oldOnClick(e);
				};
			}
		});

		dispatch.subscribe("ADD_STICKER_PREVIEW", this.addStickerPreview);
		dispatch.subscribe("CLEAR_STICKER_PREVIEW", this.clearAllStickers);

		BdApi.injectCSS(
			"multistickers",
			`.${stickerPreviewContainerCN} {
			margin-right: 4px;
		}`
		);
	}

	addStickerPreview({ channelId, draftType, sticker }) {
		stickerStore[channelId] ??= [];
		stickerStore[channelId][draftType] ??= [];
		if (stickerStore[channelId][draftType].some((s) => s === sticker)) return;

		if (stickerStore[channelId][draftType].length == 3) {
			stickerStore[channelId][draftType].shift();
		}
		stickerStore[channelId][draftType].push(sticker);
		StickerPreview.emitChange();
	}

	clearAllStickers({ channelId, draftType }) {
		delete stickerStore[channelId]?.[draftType];
		StickerPreview.emitChange();
	}

	stop() {
		BdApi.Patcher.unpatchAll("multistickers");
		dispatch.unsubscribe("ADD_STICKER_PREVIEW", this.addStickerPreview);
		dispatch.unsubscribe("CLEAR_STICKER_PREVIEW", this.clearAllStickers);
	}
};
