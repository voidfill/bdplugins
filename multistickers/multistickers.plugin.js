/**
 * @name multistickers
 * @description lets you send up to 3 stickers and shift click stickers
 * @version 2.0.0
 * @author void
 * @source https://raw.githubusercontent.com/voidfill/bdplugins/main/multistickers/multistickers.plugin.js
 */

const Api = new BdApi("multistickers");
const { byProps } = Api.Webpack.Filters;

const [StickerPreviewStore, Dispatch, ShouldAttachSticker, StickerPickerRow, CloseExpressionPicker] = Api.Webpack.getBulk.apply(
	null,
	[
		byProps("getStickerPreview"),
		byProps("dispatch", "register"),
		byProps("Hc", "Zt", "Zv", "_V", "Q6"),
		(m) => m.Z.type.toString().indexOf("e.isDisplayingIndividualStickers") !== -1,
		byProps("_Q", "PG", "j9", "RO"),
	].map((f) => (f.filter ? f : { filter: f }))
);

const previewStore = {
	lastRequest: null,
	store: [{}, {}],
	get(channelId, draftType) {
		return (draftType === 2 ? this.store[0][channelId] : this.store[1][channelId]) ?? [];
	},
	set(channelId, draftType, stickers) {
		if (draftType === 2) {
			this.store[0][channelId] = stickers;
		} else {
			this.store[1][channelId] = stickers;
		}
	},
};
const shiftEvent = {
	shouldAttachSticker: false,
	shouldNotCloseExpressionPicker: false,
};

module.exports = class multistickers {
	start() {
		Api.Patcher.instead(StickerPreviewStore, "getStickerPreview", (_, [channelId, draftType]) => {
			previewStore.lastRequest = [channelId, draftType];
			return previewStore.get(channelId, draftType);
		});

		Api.Patcher.instead(ShouldAttachSticker, "Hc", (_, args, originalFunction) => {
			if (shiftEvent.shouldAttachSticker) {
				shiftEvent.shouldAttachSticker = false;
				return true;
			}
			return originalFunction.apply(null, args);
		});

		Api.Patcher.instead(CloseExpressionPicker, "_Q", (_, args, originalFunction) => {
			if (shiftEvent.shouldNotCloseExpressionPicker) {
				shiftEvent.shouldNotCloseExpressionPicker = false;
				return;
			}
			return originalFunction.apply(null, args);
		});

		Api.Patcher.after(Api.React, "createElement", (_, args, ret) => {
			if (args?.[1]?.className !== "stickerPreviewContainer-U9ZN2r") return ret;

			const [channelId, draftType] = previewStore.lastRequest;
			const id = ret.key;
			ret.props.children[0].props.onClick = () => {
				previewStore.set(
					channelId,
					draftType,
					previewStore.get(channelId, draftType).filter((s) => s.id !== id)
				);
				StickerPreviewStore.emitChange();
			};
			return ret;
		});

		Api.Patcher.after(StickerPickerRow["Z"], "type", (_, __, ret) => {
			for (const stickerContainer of ret?.props?.children) {
				const button = stickerContainer.props.children.props;
				const originalFunction = button.onClick;
				button.onClick = (event) => {
					if (event.shiftKey) {
						shiftEvent.shouldAttachSticker = true;
						shiftEvent.shouldNotCloseExpressionPicker = true;
					}
					originalFunction(event);
				};
			}
		});

		Dispatch.subscribe("ADD_STICKER_PREVIEW", this.#addStickerPreview);
		Dispatch.subscribe("CLEAR_STICKER_PREVIEW", this.#clearStickerPreview);
		Dispatch.subscribe("LOGOUT", this.#logout);

		Api.DOM.addStyle(`.closeButton-mGpA26 { margin-right: 2px;}
.stickerPreview-3hZwLL { margin-right: 8px}`);
	}

	#addStickerPreview({ channelId, draftType, sticker }) {
		const arr = previewStore.get(channelId, draftType).filter((s) => s.id !== sticker.id);
		if (arr.length === 3) {
			arr.shift();
		}
		previewStore.set(channelId, draftType, [...arr, sticker]);
	}

	#clearStickerPreview({ channelId, draftType }) {
		previewStore.set(channelId, draftType, []);
	}

	#logout() {
		previewStore.store = [{}, {}];
	}

	stop() {
		Dispatch.unsubscribe("ADD_STICKER_PREVIEW", this.#addStickerPreview);
		Dispatch.unsubscribe("CLEAR_STICKER_PREVIEW", this.#clearStickerPreview);
		Dispatch.unsubscribe("LOGOUT", this.#logout);
		Api.Patcher.unpatchAll();
		Api.DOM.removeStyle();
		previewStore.store = [{}, {}];
	}
};
