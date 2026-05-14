.PHONY: run rerun dev clean install bank-registry

run:
	docker compose up --build

rerun:
	docker compose down && docker compose up --build

dev:
	(cd backend && alembic upgrade head && uvicorn app.main:app --reload --port 8080) & \
	(cd frontend && npm run dev)

clean:
	rm -rf frontend/node_modules frontend/dist data

install:
	python3 -m pip install -r backend/requirements.txt
	cd frontend && npm install
	$(MAKE) bank-registry

bank-registry:
	@if [ ! -f utilities/plewibnra/plewibnra.json ]; then \
		echo "Generating bank registry..."; \
		python3 utilities/plewibnra/parse_plewibnra.py; \
	fi
	@mkdir -p frontend/public
	cp utilities/plewibnra/plewibnra.json frontend/public/plewibnra.json
